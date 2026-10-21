# Synthetic evaluation brief — e-commerce with third-party integrations

This is synthetic assessment input only, not a customer record, benchmark, accuracy claim, or seeded application data.

A retailer needs a storefront and operations console connected to a payment provider, tax service, shipping carriers, inventory system, and marketing platform. Customers should browse products, check out, see order status, and receive transactional messages. Operations staff need retryable synchronization, reconciliation, refunds, audit history, and role-based access. The first release should support one region and one currency, with a path to additional locales.

## Assessment expectations (not measured results)
- Expected requirement count: 12–18 atomic requirements after decomposition.
- Known gaps to look for: provider ownership and sandbox credentials, webhook idempotency, failure/retry policy, tax and refund edge cases, PCI boundary, inventory consistency, and regional rollout criteria.
- Representative risks to consider: third-party outages, duplicate webhooks, payment reconciliation errors, stock oversell, secrets exposure, and scope growth from localization.
