import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "faqs";

// Migrated off localStorage onto Supabase — see the "faqs" table (a real
// experience_id foreign key referencing experiences.id, on delete
// cascade) and its RLS policies. Every function here is now async.
// answer defaults to "" at the database level because the Suggest FAQs
// feature (see suggestedFaqs.js) adds draft entries with just a question,
// left for the host to fill in the answer afterward via updateFaq.

function rowToFaq(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    question: row.question,
    answer: row.answer ?? "",
  };
}

function faqToRow(faq) {
  const row = {};
  if (faq.experienceId !== undefined) row.experience_id = Number(faq.experienceId);
  if (faq.question !== undefined) row.question = faq.question;
  if (faq.answer !== undefined) row.answer = faq.answer;
  return row;
}

export async function getFaqs(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[faqsStore] getFaqs failed:", error);
    return [];
  }
  return data.map(rowToFaq);
}

export async function addFaq(faq) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(faqToRow(faq))
    .select()
    .single();

  if (error) {
    console.error("[faqsStore] addFaq failed:", error);
    throw error;
  }
  return rowToFaq(data);
}

export async function updateFaq(id, fields) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(faqToRow(fields))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[faqsStore] updateFaq failed:", error);
    return null;
  }
  return rowToFaq(data);
}

// Removes every FAQ for an experience — used when the experience itself
// is deleted, so nothing is left orphaned. The table's own experience_id
// foreign key is ON DELETE CASCADE, so this call is belt-and-braces
// cleanup rather than the only thing preventing orphaned rows.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[faqsStore] deleteAllForExperience failed:", error);
  }
}

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:faqs" key is dead data now rather than left
// lingering indefinitely. Existing local test FAQs are deliberately NOT
// migrated into Supabase — starting fresh, same choice already made for
// every other migrated store.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:faqs");
}
