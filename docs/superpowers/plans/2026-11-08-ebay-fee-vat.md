# eBay fee VAT and breakdown

Match the supplied example for one UK domestic business sale by a seller who is not VAT registered: £10 sale, £5 item cost, 11.9% category fee, £0.30 order fee, £0.04 regulatory fee, £0.31 fee VAT, £1.84 total eBay fees, £6.84 total costs, £3.16 profit, 31.6% margin and 46.2% return on total costs.

Keep the existing category rates, exceptions, inputs and site styling. Add 20% VAT to the rounded marketplace fee subtotal (including promoted listing fees), include it in profit and price recommendations, and show the fee and cost components separately. Clearly scope results to the non-VAT-registered seller example; a VAT-registered seller's tax return is outside this change.

- [ ] Add browser regressions for the exact example, VAT on promotion, postage, order-fee thresholds, reduced/tiered categories, break-even/target prices, validation and reset.
- [ ] Update `assets/js/profit-calculator.js`, the calculator page and scoped result styling. Ensure recommendations use the same fee calculation as the displayed profit.
- [ ] Verify browser tests, existing Node tests, lint and static build; review and inspect a narrow layout.

Sources checked 8 November 2026: eBay UK business seller fee page (updated 5 November 2026) states category/order/regulatory fees exclude VAT; GOV.UK lists the standard VAT rate as 20%.
