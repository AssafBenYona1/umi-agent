import { randomUUID } from "node:crypto";
import { slots, bookings } from "./calendar";
import type {
  AppointmentSlot,
  ServiceType,
  Booking,
} from "./calendar";

interface AvailabilityParams {
  serviceType: ServiceType;
  preferredDate?: string;
  earliestTime?: string;
}

export function checkAvailability(
  params: AvailabilityParams
): AppointmentSlot[] {
  const availableSlots = slots.filter((slot) => {
    return (
      !slot.isBooked &&
      slot.serviceType === params.serviceType &&
      (!params.preferredDate || slot.date === params.preferredDate) &&
      (!params.earliestTime || slot.time >= params.earliestTime)
    );
  });

  return availableSlots.sort((a, b) => {
    const firstDateTime = `${a.date}T${a.time}`;
    const secondDateTime = `${b.date}T${b.time}`;

    return firstDateTime.localeCompare(secondDateTime);
  });
}


interface BookingParams {
  slotId: string;
  customerName: string;
  phone: string;
  licensePlate: string;
}

type BookingResult =
  | {
      success: true;
      booking: Booking;
      slot: AppointmentSlot;
    }
  | {
      success: false;
      reason: "INVALID_DETAILS" | "SLOT_NOT_FOUND" | "SLOT_UNAVAILABLE";
    };

export function bookAppointment(params: BookingParams): BookingResult {
  const customerName = params.customerName.trim();
  const phone = params.phone.replace(/[\s-]/g, "");
  const licensePlate = params.licensePlate.replace(/[\s-]/g, "");

  if (
    !customerName ||
    !/^05\d{8}$/.test(phone) ||
    !/^\d{7,8}$/.test(licensePlate)
  ) {
    return {
      success: false,
      reason: "INVALID_DETAILS",
    };
  }

  const slot = slots.find((slot) => slot.id === params.slotId);

  if (!slot) {
    return {
      success: false,
      reason: "SLOT_NOT_FOUND",
    };
  }

  if (slot.isBooked) {
    return {
      success: false,
      reason: "SLOT_UNAVAILABLE",
    };
  }

  const booking: Booking = {
    id: randomUUID(),
    slotId: slot.id,
    customerName,
    phone,
    licensePlate,
  };

  bookings.push(booking);
  slot.isBooked = true;

  return {
    success: true,
    booking,
    slot: { ...slot },
  };
}