Prompt for Developing the /cardviewer/{id} Page

Goal:  
Create a modern, minimalist, mobile‑optimized page at /cardviewer/{id} that retrieves card data from the backend and renders a clean, professional card‑viewer experience for Legendary Profiles.
Page Requirements

1.  Routing

    The page lives at /cardviewer/{id}.

    {id} is the unique identifier for the card.

    On load, the page must call:

        GET /card/{id} to retrieve card metadata

        GET /card/{id}/vcard when the user taps the “Download vCard” button

Data to Render

From the GET /card/{id} response, the page must display:

    Card image using the previewURL field

    Contact information, including (if present):

        Name

        Title

        Company

        Email

        Phone

        Website

        Social links

    Premium URLs

        Render each premium URL as a clean, modern button

        Buttons should open in a new tab

UI / UX Requirements

Overall aesthetic:

    Modern, minimalist, clean spacing

    Dark‑mode friendly

    Typography that feels premium but not flashy

    No clutter, no heavy borders, no unnecessary chrome

Mobile‑first layout:

    Card image centered and scaled responsively

    Contact info in a clean vertical stack

    Buttons large enough for thumb interaction

    Sticky footer or floating button for “Download vCard” is acceptable

Desktop layout:

    Maintain minimalism

    Centered content with max‑width container

    Card image left‑aligned or centered depending on design system

Component Structure

Header (optional):

    Simple top bar with the Legendary Profiles logo or a back arrow

Card Image Section:

    Full‑width container

    Image should maintain aspect ratio

    Soft drop shadow or subtle border radius allowed

Contact Info Section:

    Clean vertical list

    Icons optional but should be subtle

    Avoid dense blocks of text

Premium Links Section:

    Render each premium URL as a button

    Style: pill‑shaped or rounded rectangle

    Colors should match Legendary Profiles brand palette

    Buttons should be visually distinct but not loud

vCard Button:

    Prominent but minimalist

    Label: “Download vCard”

    Should call GET /card/{id}/vcard

Behavior Requirements

    Show a loading state while fetching card data

    Show an error state if the card cannot be found

    All external links open in a new tab

    The page should gracefully handle missing fields (e.g., no phone number)

Deliverables

The assistant should produce:

    A complete UI layout description

    Component breakdown

    Responsive behavior notes

    Optional: sample HTML/CSS/React/Vue/Svelte code depending on the stack

    Optional: animation or micro‑interaction suggestions
