# zis_tech

Public-facing static pages for apps and future website content.

This repository is intentionally separate from private product source repositories.

## Structure

Use one stable folder per app:

```text
zis_tech/
└─ spark_note/
   ├─ index.html
   ├─ privacy.html
   └─ support.html
└─ prompt_buffet/
   ├─ index.html
   ├─ privacy.html
   └─ support.html
└─ video_flow/
   ├─ index.html
   ├─ privacy.html
   └─ support.html
└─ task_planner/
   ├─ index.html
   ├─ privacy.html
   └─ support.html
```

## App pages

- `index.html`: minimal app entry page
- `privacy.html`: public privacy policy URL for store review
- `support.html`: public support URL for store review and users

Keep pages static and lightweight unless a richer public site is needed later.
