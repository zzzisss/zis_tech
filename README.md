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
   ├─ support.html
   └─ backup-viewer.html
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
└─ dice_box/
   ├─ index.html
   ├─ privacy.html
   └─ support.html
```

## App pages

- `index.html`: minimal app entry page
- `privacy.html`: public privacy policy URL for store review
- `support.html`: public support URL for store review and users
- `spark_note/backup-viewer.html`: local-only viewer for Spark Note JSON backups (version 1), with browser PDF export of the current filtered notes

Keep pages static and lightweight unless a richer public site is needed later.

Run `node --test spark_note/backup-viewer.test.cjs` to check backup reading, filters, and invalid-file handling. The test uses the Spark Note screenshot demo backup when it is available beside this repository, or a built-in sample when it is not.
