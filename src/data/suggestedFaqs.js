// Suggested FAQ questions per Experience type — purely a starting-point
// checklist for the host (see the "Suggest FAQs" modal in
// /experiences/[id]/page.tsx). Selecting one adds it as a draft FAQ with
// the question pre-filled and the answer left blank; the host can still
// edit the question wording afterward, same as any other FAQ entry.

const GENERIC_FALLBACK_QUESTIONS = [
  "What is the parking situation?",
  "Can dietary restrictions be accommodated?",
  "Is there a dress code?",
  "Who should I contact if I need assistance?",
];

export const SUGGESTED_FAQS_BY_TYPE = {
  Wedding: [
    "Is there a hotel block?",
    "Is transportation being provided?",
    "Can I bring a guest/+1?",
    "Are children welcome?",
    "Is there anything specific I should bring?",
    "Is there a gift registry?",
  ],
  "Birthday/Celebration": [
    "Is there a hotel block?",
    "Is transportation being provided?",
    "Are there any events that require special attire?",
    "Is there anything specific I should pack or bring?",
    "Are gifts expected?",
    "Is there an event hashtag?",
  ],
  "Destination Trip/Group Getaway": [
    "Is there a hotel block or preferred accommodation?",
    "Is transportation being provided?",
    "Is there anything specific I should pack or bring?",
    "Are any activities optional?",
    "Do I need to RSVP separately for any activities?",
    "Who should I contact if I need help during the trip?",
  ],
  "Corporate Retreat/Offsite": [
    "Is transportation being provided?",
    "What expenses will be covered?",
    "Is there anything specific I should pack or bring?",
    "Are any activities optional?",
    "Will there be time available for work/calls?",
    "Who should I contact with logistical questions?",
  ],
  "Conference/Professional Event": [
    "What is the parking situation?",
    "Is there a hotel block?",
    "Is there an event hashtag?",
    "Are there any social media or photography guidelines?",
    "Is there anything specific I should bring?",
    "Who should I contact if I need assistance?",
  ],
  "Dinner/Party/Social Event": [
    "What is the parking situation?",
    "Can I bring a guest/+1?",
    "Are there any special attire requirements?",
    "Are gifts expected?",
    "Is there an event hashtag?",
    "Can I post photos from the event?",
  ],
  "Wellness/Activity-Based Event": [
    "Is there anything specific I should wear?",
    "What should I bring?",
    "Do I need to bring my own equipment?",
    "Are any activities optional?",
    "Can dietary restrictions be accommodated?",
    "Who should I contact about accessibility or accommodations?",
  ],
};

// Falls back to the generic set for "Other" and for any Experience with
// no type set (experienceType is "" — optional, doesn't block creation).
export function getSuggestedFaqQuestions(experienceType) {
  return SUGGESTED_FAQS_BY_TYPE[experienceType] ?? GENERIC_FALLBACK_QUESTIONS;
}
