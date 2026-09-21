const STORAGE_KEY = "yhtbt:bookOrders";

// Entry shape: { id, experienceId, recipientName, shippingAddress: { line1,
// line2, city, state, zip, country }, status, stripeSessionId, createdAt }.
// status is one of "Requested" | "In Production" | "Shipped" — defaults to
// "Requested" on creation. Fulfillment is handled by a person right now,
// not automated, so status only ever moves forward via the host manually
// updating it on /experiences/[id].
export const BOOK_ORDER_STATUSES = ["Requested", "In Production", "Shipped"];

function readFromStorage() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeToStorage(bookOrders) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookOrders));
}

function getAllBookOrders() {
  return readFromStorage();
}

export function getBookOrders(experienceId) {
  return getAllBookOrders()
    .filter((order) => order.experienceId === experienceId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Looks up a book order already created for a given Stripe Checkout
// Session ID, so creation (see the book-order success page) can be
// idempotent the same way experience creation is.
export function getBookOrderByStripeSessionId(stripeSessionId) {
  if (!stripeSessionId) return null;
  return (
    getAllBookOrders().find(
      (order) => order.stripeSessionId === stripeSessionId
    ) ?? null
  );
}

export function addBookOrder(order) {
  const bookOrders = getAllBookOrders();
  const nextId =
    bookOrders.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) +
    1;

  const newOrder = {
    id: nextId,
    status: "Requested",
    createdAt: new Date().toISOString(),
    ...order,
  };
  const updatedOrders = [...bookOrders, newOrder];

  writeToStorage(updatedOrders);
  return newOrder;
}

export function updateBookOrderStatus(id, status) {
  const bookOrders = getAllBookOrders();
  let updatedOrder = null;

  const updatedOrders = bookOrders.map((order) => {
    if (order.id !== id) return order;
    updatedOrder = { ...order, status };
    return updatedOrder;
  });

  writeToStorage(updatedOrders);
  return updatedOrder;
}

// Removes every book order for an experience — used when the experience
// itself is deleted, so nothing is left orphaned.
export function deleteAllForExperience(experienceId) {
  const bookOrders = getAllBookOrders();
  const updatedOrders = bookOrders.filter(
    (order) => order.experienceId !== experienceId
  );
  writeToStorage(updatedOrders);
}
