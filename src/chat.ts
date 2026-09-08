import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type {
  MessageParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

import { aiClient } from "./aiClient";
import { systemPrompt } from "./systemPrompt";
import { tools } from "./tools";
import { slots } from "./calendar";
import { checkAvailability, bookAppointment } from "./appointmentService";

const DEBUG = process.env.DEBUG === "true";
const terminal = createInterface({
  input: stdin,
  output: stdout,
});

const MAX_REQUESTS = 20;
const MAX_TOOL_ROUNDS = 4;

let requestCount = 0;
let bookingCompleted = false;

const messages: MessageParam[] = [];

function getObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Tool input must be an object");
  }

  return input as Record<string, unknown>;
}

function getString(input: Record<string, unknown>, key: string): string {
  const value = input[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid field: ${key}`);
  }

  return value.trim();
}

async function executeTool(name: string, rawInput: unknown) {
  const input = getObject(rawInput);

  if (name === "checkAvailability") {
    const serviceType = getString(input, "serviceType");

    if (serviceType !== "periodic" && serviceType !== "diagnostic") {
      throw new Error("Invalid serviceType");
    }

    const preferredDate =
      input.preferredDate === undefined
        ? undefined
        : getString(input, "preferredDate");

    const earliestTime =
      input.earliestTime === undefined
        ? undefined
        : getString(input, "earliestTime");

    if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      throw new Error("Date must use YYYY-MM-DD format");
    }

    if (earliestTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(earliestTime)) {
      throw new Error("Time must use HH:mm format");
    }

    return checkAvailability({
      serviceType,
      preferredDate,
      earliestTime,
    });
  }

  if (name === "bookAppointment") {
    if (bookingCompleted) {
      return {
        success: false,
        reason: "BOOKING_ALREADY_COMPLETED_THIS_SESSION",
      };
    }

    const params = {
      slotId: getString(input, "slotId"),
      customerName: getString(input, "customerName"),
      phone: getString(input, "phone"),
      licensePlate: getString(input, "licensePlate"),
    };

    const slot = slots.find((item) => item.id === params.slotId);

    if (!slot) {
      return { success: false, reason: "SLOT_NOT_FOUND" };
    }

    if (slot.isBooked) {
      return { success: false, reason: "SLOT_UNAVAILABLE" };
    }

    const service =
      slot.serviceType === "periodic" ? "טיפול תקופתי" : "אבחון תקלה";

    console.log("\n--- אישור הזמנה דרך התוכנית ---");
    console.log("מוסך: UMI מדומה בראשון לציון");
    console.log(`שירות: ${service}`);
    console.log(`מועד הגעה: ${slot.date} בשעה ${slot.time}`);
    console.log(`שם: ${params.customerName}`);
    console.log(`טלפון: ${params.phone}`);
    console.log(`מספר רישוי: ${params.licensePlate}`);

    const confirmation = await terminal.question(
      'להזמנה הקלד בדיוק "מאשר". כל תשובה אחרת תבטל את הפעולה: ',
    );

    if (confirmation.trim() !== "מאשר") {
      return {
        success: false,
        reason: "CUSTOMER_DID_NOT_CONFIRM",
      };
    }

    const result = bookAppointment(params);

    if (result.success) {
      bookingCompleted = true;
    }

    return result;
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function runAgentTurn() {
  let toolRounds = 0;

  while (true) {
    if (requestCount >= MAX_REQUESTS) {
      throw new Error("הגענו למגבלת 20 הבקשות להרצה.");
    }

    requestCount++;

    const response = await aiClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: [
        systemPrompt,
        `Current date in Israel: ${new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jerusalem",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())}`,
        "This demo permits one successful booking per session.",
        "bookAppointment includes an additional terminal confirmation.",
        "If CUSTOMER_DID_NOT_CONFIRM is returned, ask what should change.",
        "Never claim a booking succeeded when any tool returns failure.",
      ].join("\n"),
      messages,
      tools,
    });
    if (DEBUG) {
      console.log(
        `\n[בקשה ${requestCount}/${MAX_REQUESTS}` +
          ` | טוקני קלט: ${response.usage.input_tokens}` +
          ` | טוקני פלט: ${response.usage.output_tokens}]`,
      );
    }
    // לא מפעילים כלים מתוך תשובה שנקטעה.
    if (response.stop_reason === "max_tokens") {
      throw new Error("תשובת המודל נקטעה במגבלת הטוקנים.");
    }

    messages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults: ToolResultBlockParam[] = [];
    const hasTools = response.content.some(
      (block) => block.type === "tool_use",
    );

    if (hasTools) {
      toolRounds++;

      if (toolRounds > MAX_TOOL_ROUNDS) {
        throw new Error("חריגה ממגבלת סבבי הכלים להודעה.");
      }

      // משאירים בקשה אחת לקבלת תשובה אחרי הפעלת הכלים.
      if (requestCount >= MAX_REQUESTS) {
        throw new Error("מגבלת הבקשות הושגה. הכלים לא הופעלו.");
      }
    }

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`\nסוכן: ${block.text}`);
      }

      if (block.type === "tool_use") {
        if (DEBUG) {
          console.log(`\n[הפעלת כלי: ${block.name}]`);
        }

        try {
          const result = await executeTool(block.name, block.input);
          if (DEBUG) {
            console.log("[תוצאת הכלי]", JSON.stringify(result));
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: error instanceof Error ? error.message : "Tool failed",
          });
        }
      }
    }

    if (!hasTools) {
      return;
    }

    messages.push({
      role: "user",
      content: toolResults,
    });
  }
}

async function main() {
  console.log('."exit" דמו לתיאום תורים. לסיום הקלד ');
  console.log("השתמש בפרטי דמה בלבד.");

  try {
    while (!bookingCompleted) {
      const text = (await terminal.question("\nאתה: ")).trim();

      if (text.toLowerCase() === "exit") {
        break;
      }

      if (!text) {
        continue;
      }

      if (text.length > 1_000) {
        console.log("נא להזין הודעה באורך של עד 1,000 תווים.");
        continue;
      }

      messages.push({ role: "user", content: text });
      await runAgentTurn();
    }
  } catch (error) {
    console.error(
      "\nההרצה נעצרה:",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    terminal.close();
  }
}

void main();
