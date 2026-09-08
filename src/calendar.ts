export type ServiceType = "periodic" | "diagnostic";

export interface AppointmentSlot {
  id: string;
  garageId: string;
  date: string;
  time: string;
  serviceType: ServiceType;
  isBooked: boolean;
}

export interface Booking {
  id: string;
  slotId: string;
  customerName: string;
  phone: string;
  licensePlate: string;
}

// נתוני דמה לצורך ההדגמה בלבד.
// התאריך המקומי של היום הראשון ביומן יהיה מחר.
function getFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export const slots: AppointmentSlot[] = [
  {
    id: "slot-1",
    garageId: "umi-demo-rishon",
    date: getFutureDate(1),
    time: "08:00",
    serviceType: "periodic",
    isBooked: false,
  },
  {
    id: "slot-2",
    garageId: "umi-demo-rishon",
    date: getFutureDate(1),
    time: "10:00",
    serviceType: "periodic",
    isBooked: false,
  },
  {
    id: "slot-3",
    garageId: "umi-demo-rishon",
    date: getFutureDate(2),
    time: "09:00",
    serviceType: "periodic",
    isBooked: false,
  },
  {
    id: "slot-4",
    garageId: "umi-demo-rishon",
    date: getFutureDate(1),
    time: "11:00",
    serviceType: "diagnostic",
    isBooked: false,
  },
  {
    id: "slot-5",
    garageId: "umi-demo-rishon",
    date: getFutureDate(1),
    time: "14:00",
    serviceType: "diagnostic",
    isBooked: false,
  },
  {
    id: "slot-6",
    garageId: "umi-demo-rishon",
    date: getFutureDate(2),
    time: "09:00",
    serviceType: "diagnostic",
    isBooked: false,
  },
];

export const bookings: Booking[] = [];
