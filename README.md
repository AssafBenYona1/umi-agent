# UMI Appointment Agent — TypeScript PoC

A Hebrew conversational appointment-booking prototype built with TypeScript, Node.js and the Anthropic Messages API. The application accepts typed customer messages as simulated call transcripts and uses real model tool calling to query and update a mock garage calendar.

## Scope

The assignment explicitly permits text in place of voice input. This PoC implements the conversation and booking logic. It does not implement telephony, speech recognition, speech synthesis, SMS delivery or integration with UMI's actual systems. Vapi, Azure Speech and telephony belong to the proposed production architecture, not to this executable demo.

The demo supports one fictional UMI garage in Rishon LeZion and two services:

- `periodic`: periodic maintenance.
- `diagnostic`: investigation of a reported fault.

Use fictional customer details only. This is not an actual UMI booking service.

## Requirements and setup

- Node.js with npm (Node.js 22 or later is a suitable project baseline).
- An Anthropic API key with access to `claude-haiku-4-5-20251001` and available API credit.
- A terminal that correctly displays Hebrew. The tested conversation was run in macOS Terminal; the VS Code integrated terminal displayed Hebrew incorrectly in the user's environment.

From the repository root:

```bash
npm install
cp .env.example .env
```

Set the following value in `.env`:

```dotenv
ANTHROPIC_API_KEY=your_api_key_here
```

Never commit `.env` or credentials. The included `.env.example` contains only a placeholder. Include `package.json` and `package-lock.json` in the repository so dependencies can be installed reproducibly.

## Run

Check the calendar functions without calling the model:

```bash
npx tsx src/demo.ts
```

Start the interactive AI conversation:

```bash
npx tsx src/chat.ts
```

Type a message such as `שלום, אני רוצה לקבוע טיפול תקופתי`. Type `exit` at the main customer prompt to stop.

When the application presents its final booking summary, type exactly `מאשר` to execute the booking. Any other answer at that confirmation prompt declines the operation. This additional terminal confirmation is an explicit PoC safeguard; it is separate from the model's conversational confirmation.

For tool and token diagnostics, if the DEBUG guards described in the project have been applied:

```bash
DEBUG=true npx tsx src/chat.ts
```

## Project files

| File | Responsibility |
| --- | --- |
| `src/calendar.ts` | Service and booking types, mock slots and in-memory bookings. |
| `src/appointmentService.ts` | Availability filtering and booking validation/mutation. |
| `src/demo.ts` | Assertions for successful booking, removal from availability and rejection of an occupied slot. |
| `src/systemPrompt.ts` | English instructions for a Hebrew customer conversation. |
| `src/tools.ts` | JSON input schemas and descriptions exposed to the model. |
| `src/aiClient.ts` | API client, environment-based key, request timeout and retry settings. |
| `src/chat.ts` | Terminal interaction, conversation history, tool execution and session limits. |

## Execution flow

1. A customer types a message.
2. The application sends the system prompt, conversation history and tool definitions to Claude.
3. Claude returns either customer-facing text or a structured tool request.
4. The application validates the tool input and dispatches it to an allowlisted local function.
5. The function result is sent back to Claude as a `tool_result`.
6. Claude continues the conversation using that result.
7. A booking executes only after the application's explicit confirmation prompt is accepted. A successful booking ends the session after the model's response.

The model requests operations; the application performs them. The model has no direct database access.

## Tools

### `checkAvailability`

Required: `serviceType`. Optional: `preferredDate` (`YYYY-MM-DD`) and `earliestTime` (`HH:mm`).

Returns unbooked slots of the requested service, sorted by date and time. `preferredDate` matches an exact date. `earliestTime` is inclusive and applies to every candidate day when no date is supplied. This tool does not reserve a slot.

### `bookAppointment`

Required: `slotId`, `customerName`, `phone`, `licensePlate`.

The booking function normalizes spaces/hyphens in phone and plate values, requires a nonempty name, checks a local Israeli mobile format (`05` plus eight digits) and a 7–8 digit plate, and rejects missing or occupied slots. These checks validate format, not identity or ownership. A successful call generates a booking UUID, stores the booking and marks the slot as occupied.

Function failure reasons: `INVALID_DETAILS`, `SLOT_NOT_FOUND`, `SLOT_UNAVAILABLE`. The conversation wrapper additionally handles declined confirmation and an already completed session booking.

## Demo scenarios

### Scenario 1 — Periodic maintenance

Transcript: [logs/scenario-1.txt](logs/scenario-1.txt).

The customer requested routine maintenance and accepted the earliest available appointment. The agent collected the customer details, summarized the booking and requested confirmation. After the terminal confirmation, the booking tool returned `success: true` for September 9, 2026 at 08:00. The agent then confirmed the appointment and clarified that this was the arrival time. The recorded tool output provides evidence of the availability query and booking result.

### Scenario 2 — Diagnostic appointment with a change of time

Transcript: [logs/scenario-2.txt](logs/scenario-2.txt).

The customer reported a water leak and requested an inspection. The agent selected the diagnostic service, collected the booking details and offered September 9, 2026 at 11:00. After initially accepting, the customer changed their preference before the booking was executed. The conversation considered another day and then returned to an alternative time on September 9. The final summary and terminal confirmation specified 14:00, and the agent announced a successful booking at that time.

This scenario demonstrates a change to a proposed appointment before booking, not cancellation or rescheduling of an existing booking. The original 11:00 proposal had not been confirmed through the application's booking gate. The supplied transcript contains the terminal confirmation and final success message but does not display raw tool results or subsequent calendar inspection.

The calendar used for scenario 2 includes additional diagnostic alternatives: 14:00 on the first demo day and 09:00 on the following day. Include those slots in `src/calendar.ts` to reproduce the scenario. Availability is service-specific: a free periodic-maintenance slot is not returned for a diagnostic request. Seed dates move with the date of each new run, so a later reproduction will show different dates.

### Recording conversations

On macOS, record each run from the repository root:

```bash
mkdir -p logs
script -q logs/scenario-1.txt npx tsx src/chat.ts
script -q logs/scenario-2.txt npx tsx src/chat.ts
```

Run the recording commands separately, completing the first conversation before starting the second. Terminal recordings may contain control sequences. Preserve the originals and label any cleaned presentation excerpts. Review logs for personal data before publishing.

## Cost controls

The demonstrated implementation caps each process run at 20 model requests and 800 output tokens per request, with at most four executed tool rounds per customer message. Automatic SDK retries are disabled and the request timeout is 30 seconds. A timeout does not guarantee that an in-flight request is unbilled. Input includes conversation history, so input-token usage generally grows during a conversation.

These controls are not a dollar-denominated spending cap and reset on restart. Configure an appropriate Console workspace spending limit and disable automatic credit reload for a bounded demo budget. Merely creating the API client does not invoke the model.

## Limitations

- Calendar and booking data are in memory and reset when the process restarts. The source file is not rewritten.
- Seed dates are generated relative to the host machine's date. The model is given the current date in Israel. Run with the host timezone set to Israel for consistent relative-date behavior. Seed dates do not implement real business-day or holiday rules.
- No persistent idempotency store, database transaction, multi-process concurrency guarantee or recovery after restart is implemented. The local occupied-slot check is not a production concurrency solution.
- The model's wording and ordering of questions can vary. The diagnostic transcript includes an unnecessary repeat request for the customer's name and some awkward Hebrew. Prompt instructions are not hard application guarantees.
- Safety triage needs further work before production. The diagnostic conversation relied on the customer's statement that the vehicle runs; that does not establish that it is safe to drive. A production service requires an approved symptom-based escalation flow.
- Date validation checks the input format; it is not a complete validation of real calendar dates. The mock calendar is the source of available dates.
- There is no customer identity verification, medical/mechanical diagnosis, human transfer or actual callback creation.
- The terminal confirmation is intentionally an extra demo step. A production voice flow needs an equivalent enforced confirmation state.
- Diagnostic output can contain customer data. Use mock data and avoid publishing secrets or real personal details.

## Evidence status

Two recorded conversations demonstrate the normal booking path and a change of time before booking. Scenario 1 includes raw tool evidence; scenario 2 shows the revised booking details in the application confirmation and the final agent response. The local calendar assertion demo was also reported as passing during development.

The transcripts document the application and prompt versions used for those runs. They do not establish that every scenario or later prompt revision has been tested. No live UMI integration or voice performance has been tested.
