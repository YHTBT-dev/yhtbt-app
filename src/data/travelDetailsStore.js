import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "travel_details";

// Entry shape depends on "type":
// - flight: { id, experienceId, type: "flight", guestName?, airline,
//   flightNumber, departureAirport, arrivalAirport, departureDate?,
//   departureTime?, arrivalDate, arrivalTime }
// - hotel: { id, experienceId, type: "hotel", hotelName, address,
//   checkInDate, checkOutDate, confirmationNumber? }
// - transport: { id, experienceId, type: "transport", description,
//   pickupLocation, pickupDate, pickupTime, notes? }
//
// Migrated off localStorage onto Supabase — all three shapes live in one
// "travel_details" table (a real experience_id foreign key referencing
// experiences.id, on delete cascade, plus a check constraint on type),
// with each type's own fields as nullable columns unused by the other
// two types. Every function here is now async. experienceId stays a
// plain string everywhere else in the app — the table's experience_id
// column is a real bigint, so rowToEntry/entryToRow convert between the
// two, same pattern as the other migrated stores.
//
// Date fields (departureDate, arrivalDate, checkInDate, checkOutDate,
// pickupDate) use Postgres's date type; time-of-day fields
// (departureTime, arrivalTime, pickupTime) stay plain "HH:MM" text,
// matching how itineraryStore.js treats the same kind of value.

function rowToEntry(row) {
  const base = {
    id: row.id,
    experienceId: String(row.experience_id),
    type: row.type,
  };

  if (row.type === "flight") {
    return {
      ...base,
      guestName: row.guest_name ?? undefined,
      airline: row.airline,
      flightNumber: row.flight_number,
      departureAirport: row.departure_airport,
      arrivalAirport: row.arrival_airport,
      departureDate: row.departure_date ?? undefined,
      departureTime: row.departure_time ?? undefined,
      arrivalDate: row.arrival_date,
      arrivalTime: row.arrival_time,
    };
  }

  if (row.type === "hotel") {
    return {
      ...base,
      hotelName: row.hotel_name,
      address: row.address,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      confirmationNumber: row.confirmation_number ?? undefined,
    };
  }

  // transport
  return {
    ...base,
    description: row.description,
    pickupLocation: row.pickup_location,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    notes: row.notes ?? undefined,
  };
}

// Only maps fields actually present on the input, so a partial update()
// call doesn't accidentally overwrite unrelated columns with
// undefined/null — same guard as experiencesStore.js's experienceToRow.
function entryToRow(entry) {
  const row = {};
  if (entry.experienceId !== undefined) row.experience_id = Number(entry.experienceId);
  if (entry.type !== undefined) row.type = entry.type;

  if (entry.guestName !== undefined) row.guest_name = entry.guestName || null;
  if (entry.airline !== undefined) row.airline = entry.airline;
  if (entry.flightNumber !== undefined) row.flight_number = entry.flightNumber;
  if (entry.departureAirport !== undefined) row.departure_airport = entry.departureAirport;
  if (entry.arrivalAirport !== undefined) row.arrival_airport = entry.arrivalAirport;
  if (entry.departureDate !== undefined) row.departure_date = entry.departureDate || null;
  if (entry.departureTime !== undefined) row.departure_time = entry.departureTime || null;
  if (entry.arrivalDate !== undefined) row.arrival_date = entry.arrivalDate;
  if (entry.arrivalTime !== undefined) row.arrival_time = entry.arrivalTime;

  if (entry.hotelName !== undefined) row.hotel_name = entry.hotelName;
  if (entry.address !== undefined) row.address = entry.address;
  if (entry.checkInDate !== undefined) row.check_in_date = entry.checkInDate;
  if (entry.checkOutDate !== undefined) row.check_out_date = entry.checkOutDate;
  if (entry.confirmationNumber !== undefined)
    row.confirmation_number = entry.confirmationNumber || null;

  if (entry.description !== undefined) row.description = entry.description;
  if (entry.pickupLocation !== undefined) row.pickup_location = entry.pickupLocation;
  if (entry.pickupDate !== undefined) row.pickup_date = entry.pickupDate;
  if (entry.pickupTime !== undefined) row.pickup_time = entry.pickupTime;
  if (entry.notes !== undefined) row.notes = entry.notes || null;

  return row;
}

export async function getTravelDetails(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[travelDetailsStore] getTravelDetails failed:", error);
    return [];
  }
  return data.map(rowToEntry);
}

export async function addTravelDetail(entry) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(entryToRow(entry))
    .select()
    .single();

  if (error) {
    console.error("[travelDetailsStore] addTravelDetail failed:", error);
    throw error;
  }
  return rowToEntry(data);
}

export async function updateTravelDetail(id, fields) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(entryToRow(fields))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[travelDetailsStore] updateTravelDetail failed:", error);
    return null;
  }
  return rowToEntry(data);
}

export async function deleteTravelDetail(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

  if (error) {
    console.error("[travelDetailsStore] deleteTravelDetail failed:", error);
  }
}

// Removes every travel detail entry for an experience — used when the
// experience itself is deleted, so nothing is left orphaned. The table's
// own experience_id foreign key is ON DELETE CASCADE, so this is now a
// belt-and-braces call rather than the only thing preventing orphaned
// rows — deleting the experience row directly would clean these up too.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[travelDetailsStore] deleteAllForExperience failed:", error);
  }
}

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:travelDetails" key is dead data now rather than
// left lingering indefinitely. Existing local test entries are
// deliberately NOT migrated into Supabase — starting fresh there, same
// call already made for Photos, Guests, and Itinerary — so this just
// clears the stale key; removeItem on an already-removed key is a
// no-op, safe to run on every load.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:travelDetails");
}
