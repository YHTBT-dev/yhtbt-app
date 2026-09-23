import { deleteExperience } from "@/data/experiencesStore";
import { deleteAllForExperience as deleteAllItineraryItems } from "@/data/itineraryStore";
import { deleteAllForExperience as deleteAllGuests } from "@/data/guestsStore";
import { deleteAllForExperience as deleteAllTravelDetails } from "@/data/travelDetailsStore";
import { deleteAllForExperience as deleteAllPhotos } from "@/data/photosStore";
import { deleteAllForExperience as deleteAllFaqs } from "@/data/faqsStore";
import { deleteAllForExperience as deleteAllPolls } from "@/data/pollsStore";
import { deleteAllForExperience as deleteAllUpdates } from "@/data/updatesStore";
import { deleteAllForExperience as deleteNoteForExperience } from "@/data/notesStore";
import { deleteAllForExperience as deleteAllReflections } from "@/data/reflectionsStore";
import { deleteAllForExperience as deleteAllBookOrders } from "@/data/bookOrdersStore";
import { deleteAllForExperience as deleteAllRecommendations } from "@/data/recommendationsStore";

// Single entry point for deleting an Experience: removes the experience
// record itself plus everything keyed to it across every other store
// (itinerary, guests, travel details, photos, FAQs, polls, updates,
// notes, reflections, book orders, recommendations), so nothing orphaned
// is left behind. Irreversible.
//
// experienceId should be the string form (as used everywhere else, e.g.
// route params) — it's converted to a number only for the experiencesStore
// call, which stores ids numerically.
//
// Async because deleteAllPhotos/deleteAllReflections also delete each
// photo's file from Supabase Storage, not just the database/local
// record, and deleteAllItineraryItems/deleteAllGuests/
// deleteAllTravelDetails/deleteAllPhotos/deleteAllPolls/deleteAllFaqs/
// deleteAllUpdates are now real Supabase calls too. For itinerary
// items/guests/travel details/polls/FAQs/updates, those tables'
// experience_id columns are ALSO ON DELETE CASCADE at the database
// level, so those calls are belt-and-braces cleanup for the rows
// themselves — deleteAllPolls also still does the useful extra work of
// pruning the deleted poll ids out of the separate, still-localStorage
// voted-polls list, which the database cascade can't reach. Photos is
// different: its experience_id is ON DELETE CASCADE too (covers orphaned
// database rows), but a foreign key cascade can't reach outside the
// database — deleteAllPhotos actually deleting each Storage file, below,
// is still the only thing that prevents orphaned files sitting in
// Storage with no record pointing at them.
export async function deleteExperienceCompletely(experienceId) {
  await deleteAllItineraryItems(experienceId);
  await deleteAllGuests(experienceId);
  await deleteAllTravelDetails(experienceId);
  await deleteAllPhotos(experienceId);
  await deleteAllFaqs(experienceId);
  await deleteAllPolls(experienceId);
  await deleteAllUpdates(experienceId);
  deleteNoteForExperience(experienceId);
  await deleteAllReflections(experienceId);
  deleteAllBookOrders(experienceId);
  deleteAllRecommendations(experienceId);
  await deleteExperience(Number(experienceId));
}
