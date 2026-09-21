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

// Single entry point for deleting an Experience: removes the experience
// record itself plus everything keyed to it across every other store
// (itinerary, guests, travel details, photos, FAQs, polls, updates,
// notes, reflections, book orders), so nothing orphaned is left behind.
// Irreversible.
//
// experienceId should be the string form (as used everywhere else, e.g.
// route params) — it's converted to a number only for the experiencesStore
// call, which stores ids numerically.
export function deleteExperienceCompletely(experienceId) {
  deleteAllItineraryItems(experienceId);
  deleteAllGuests(experienceId);
  deleteAllTravelDetails(experienceId);
  deleteAllPhotos(experienceId);
  deleteAllFaqs(experienceId);
  deleteAllPolls(experienceId);
  deleteAllUpdates(experienceId);
  deleteNoteForExperience(experienceId);
  deleteAllReflections(experienceId);
  deleteAllBookOrders(experienceId);
  deleteExperience(Number(experienceId));
}
