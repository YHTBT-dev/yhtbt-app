import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "book_orders";

// status is one of "Requested" | "In Production" | "Shipped" (enforced by
// a CHECK constraint on the table too) — defaults to "Requested" on
// creation. Fulfillment is handled by a person right now, not automated,
// so status only ever moves forward via the host manually updating it on
// /experiences/[id].
export const BOOK_ORDER_STATUSES = ["Requested", "In Production", "Shipped"];

// Migrated off localStorage onto Supabase — see the "book_orders" table
// (a real experience_id foreign key referencing experiences.id, on
// delete cascade) and its RLS policies. Every function here is now
// async. shippingAddress is a nested object in the app's shape ({ line1,
// line2, city, state, zip, country }) but flattened into individual
// shipping_* columns on the table, matching how travel_details flattened
// its per-type fields rather than using a jsonb blob.

function rowToBookOrder(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    recipientName: row.recipient_name,
    shippingAddress: {
      line1: row.shipping_line1,
      line2: row.shipping_line2 ?? "",
      city: row.shipping_city,
      state: row.shipping_state,
      zip: row.shipping_zip,
      country: row.shipping_country,
    },
    status: row.status,
    stripeSessionId: row.stripe_session_id ?? null,
    createdAt: row.created_at,
  };
}

function bookOrderToRow(order) {
  const row = {};
  if (order.experienceId !== undefined) row.experience_id = Number(order.experienceId);
  if (order.recipientName !== undefined) row.recipient_name = order.recipientName;
  if (order.shippingAddress !== undefined) {
    const address = order.shippingAddress;
    row.shipping_line1 = address.line1;
    row.shipping_line2 = address.line2 ?? "";
    row.shipping_city = address.city;
    row.shipping_state = address.state;
    row.shipping_zip = address.zip;
    row.shipping_country = address.country;
  }
  if (order.status !== undefined) row.status = order.status;
  if (order.stripeSessionId !== undefined) row.stripe_session_id = order.stripeSessionId;
  return row;
}

export async function getBookOrders(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[bookOrdersStore] getBookOrders failed:", error);
    return [];
  }
  return data.map(rowToBookOrder);
}

// Looks up a book order already created for a given Stripe Checkout
// Session ID, so creation (see the book-order success page) can be
// idempotent the same way experience creation is.
export async function getBookOrderByStripeSessionId(stripeSessionId) {
  if (!stripeSessionId) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (error) {
    console.error(
      "[bookOrdersStore] getBookOrderByStripeSessionId failed:",
      error
    );
    return null;
  }
  return data ? rowToBookOrder(data) : null;
}

export async function addBookOrder(order) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(bookOrderToRow(order))
    .select()
    .single();

  if (error) {
    console.error("[bookOrdersStore] addBookOrder failed:", error);
    throw error;
  }
  return rowToBookOrder(data);
}

export async function updateBookOrderStatus(id, status) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[bookOrdersStore] updateBookOrderStatus failed:", error);
    return null;
  }
  return rowToBookOrder(data);
}

// Removes every book order for an experience — used when the experience
// itself is deleted, so nothing is left orphaned. The table's own
// experience_id foreign key is ON DELETE CASCADE, so this call is
// belt-and-braces cleanup rather than the only thing preventing orphaned
// rows.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[bookOrdersStore] deleteAllForExperience failed:", error);
  }
}

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:bookOrders" key is dead data now rather than
// left lingering indefinitely. Existing local test book orders are
// deliberately NOT migrated into Supabase — starting fresh, same choice
// already made for every other migrated store.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:bookOrders");
}
