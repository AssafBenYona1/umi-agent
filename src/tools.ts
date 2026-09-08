export const tools = [
  {
    name: "checkAvailability",
    description:
      "Find available appointments at the simulated UMI garage. " +
      "Returns unbooked slots matching the requested service, " +
      "sorted by date and time from earliest to latest. " +
      "Optional filters specify an exact date and an earliest time. " +
      "This tool does not reserve or book an appointment.",

    input_schema: {
      type: "object" as const,
      properties: {
        serviceType: {
          type: "string",
          enum: ["periodic", "diagnostic"],
          description:
            "Use periodic for routine maintenance " +
            "or diagnostic for investigating a vehicle fault.",
        },
        preferredDate: {
          type: "string",
          description:
            "Optional exact appointment date in YYYY-MM-DD format. " +
            "Omit if the customer has no preferred date.",
        },
        earliestTime: {
          type: "string",
          description:
            "Optional earliest acceptable time in HH:mm format, " +
            "using a 24-hour clock. The specified time is included. " +
            "Without preferredDate, this filter applies to every date.",
        },
      },
      required: ["serviceType"],
      additionalProperties: false,
    },
  },
  {
    name: "bookAppointment",
    description:
      "Book an available appointment using a slot ID returned " +
      "by checkAvailability. Use only after collecting customer " +
      "details and receiving explicit confirmation of the complete " +
      "booking summary. Returns success with booking details, " +
      "or failure with INVALID_DETAILS, SLOT_NOT_FOUND, " +
      "or SLOT_UNAVAILABLE. This tool does not send an SMS.",

    input_schema: {
      type: "object" as const,
      properties: {
        slotId: {
          type: "string",
          description:
            "The exact ID of the customer-selected slot " +
            "returned by checkAvailability. Never invent an ID.",
        },
        customerName: {
          type: "string",
          description: "The customer's name, as provided by the customer.",
        },
        phone: {
          type: "string",
          description:
            "An Israeli mobile phone number in local format: " +
            "10 digits starting with 05.",
        },
        licensePlate: {
          type: "string",
          description: "The vehicle's license plate number: 7 or 8 digits.",
        },
      },
      required: ["slotId", "customerName", "phone", "licensePlate"],
      additionalProperties: false,
    },
  },
];