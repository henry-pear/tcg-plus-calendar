/*
 * Union Arena Calendar
 * Copyright (C) 2026 Enrique Peña Arenzana
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

async function waitForElement(elementName, timeout = 3001) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            const items = document.querySelectorAll(elementName);
            if (items.length > 0) {
                clearInterval(intervalId);
                resolve(items);
            } else if (Date.now() - start > timeout) {
                clearInterval(intervalId);
                reject(new Error(`Element ${items} not found within timeout`));
            }
        };
        const intervalId = setInterval(check, 500);
        // Immediate check
        check();
    });
}

function parseEventDate(dateText) {
    const cleaned = dateText
        .replace(/^.*?\s/, "")
        .replace("～", "")
        .trim();
    return new Date(cleaned);
}

async function createCalendarButton(eventId, button, calendarUrl) {
    const MAX_RETRIES = 4;
    let retryCount = 0;
    // Check whether this event was previously marked as added
    const result = await chrome.storage.local.get(eventId);
    if (result[eventId]) {
        button.textContent = "✓ Added";
        button.classList.add("ua-calendar-added");
        button.setAttribute("aria-disabled", "true");
    }
    button.addEventListener("click", async () => {
        // Button is currently in the "Added" state
        if (button.classList.contains("ua-calendar-added")) {
            retryCount++;
            // After the fourth retry, reset the button
            if (retryCount >= MAX_RETRIES) {
                retryCount = 0;
                button.textContent = "📅 Add to Calendar";
                button.classList.remove("ua-calendar-added");
                button.removeAttribute("aria-disabled");

                // Remove the stored "added" state so the next attempt is treated as a new initial attempt.
                await chrome.storage.local.remove(eventId);
                return;
            }
            // Show remaining retry attempts
            const remaining = MAX_RETRIES - retryCount;
            button.textContent = `↻ Retry? (${remaining} remaining)`;
            return;
        }

        // First attempt
        window.open(calendarUrl, "_blank");
        // Remember that the user attempted to add this event
        await chrome.storage.local.set({
            [eventId]: true,
        });
        // Change button to Added state
        button.textContent = "✓ Added";
        button.classList.add("ua-calendar-added");
        button.setAttribute("aria-disabled", "true");
    });
}

waitForElement(".event-item").then((elements) => {
    elements.forEach((event) => {
        const dateText = event
            .querySelector(".event-date")
            ?.textContent?.trim();

        const seriesName = event
            .querySelector(".event-series-name")
            ?.textContent?.trim();

        const storeName = event
            .querySelector(".event-name-link")
            ?.textContent?.trim();

        const address = event
            .querySelector(".event-address")
            ?.childNodes[0]?.textContent?.trim();

        const date = parseEventDate(dateText);
        const url = buildCalendarLink(
            `${seriesName} @ ${storeName}`,
            date,
            address,
            `Store: ${storeName}`
        );
        const eventId = `${seriesName}-${dateText}`;
        const button = document.createElement("button");
        button.textContent = "📅 Add to Calendar";
        button.classList.add("ua-calendar-btn");
        button.className = "btn btn-primary";

        createCalendarButton(eventId, button, url).then(() => {
            event.querySelector(".event-item-buttons").appendChild(button);
        });
    });
});
function formatGoogleDate(date) {
    return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
}

function buildCalendarLink(title, start, location, description) {
    const end = new Date(start);
    end.setHours(end.getHours() + 3);

    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: title,
        dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
        location,
        details: description,
    });

    return `https://calendar.google.com/calendar/render?${params}`;
}
