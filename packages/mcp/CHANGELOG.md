# Changelog

## 1.0.0

Breaking GA release. The 0.1.0 package remains installable by exact version. Removed from the 1.0 surface: `presend_check`, `doorman_check`, `get_credits`, and `get_pricing`. Migrate single checks to `verify_email`; only the GA single and batch API is exposed.
