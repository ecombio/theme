Your breakpoints from the CSS:

| Name | Range | Media query |
|---|---|---|
| Desktop | ≥ 1024px | (default — no query) |
| Tablet | 600px – 1023px | `@media (max-width: 1023px)` |
| Mobile | < 600px | `@media (max-width: 599px)` |

That's it. Desktop is your base styles, tablet and mobile layer on top with `max-width` overrides.