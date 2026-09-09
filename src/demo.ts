import assert from "node:assert/strict";
import {
  checkAvailability,
  bookAppointment,
} from "./appointmentService";

const availableSlots = checkAvailability({
  serviceType: "periodic",
});

console.log("Available slots:", availableSlots);

const selectedSlot = availableSlots[0];

if (!selectedSlot) {
  throw new Error("No available slots for the demo");
}

const bookingParams = {
  slotId: selectedSlot.id,
  customerName: "Demo Customer",
  phone: "0500000000",
  licensePlate: "12345678",
};

const result = bookAppointment(bookingParams);

assert.equal(result.success, true, "The booking should succeed");

console.log("Booking result:", result);

const remainingSlots = checkAvailability({
  serviceType: "periodic",
});

assert.equal(
  remainingSlots.some((slot) => slot.id === selectedSlot.id),
  false,
  "The booked slot should no longer be available"
);

const duplicateResult = bookAppointment(bookingParams);

assert.deepEqual(duplicateResult, {
  success: false,
  reason: "SLOT_UNAVAILABLE",
});

console.log("Duplicate booking result:", duplicateResult);
console.log("All checks passed!");