# Reynolds County Residential preview under RipCurrent Works

This folder is staged to live under the RipCurrent Works site at:

`/rcr-preview/`

## Intended preview URL
If the RipCurrent Works site is deployed at `https://ripcurrentworks.com`, the preview URL would be:

`https://ripcurrentworks.com/rcr-preview/`

## Light password protection
A lightweight front-end password gate is built into `index.html`.

Current password:

`tony-preview`

To change it, edit this line in `index.html`:

```js
const PASSWORD = 'bones';
```

## Important note
This is only light protection. It is good enough for a casual private preview link, but it is **not** secure for sensitive/private data.

## Files
- `index.html` - gated preview page
- `styles.css` - site styles
- `assets/` - copied project photos
