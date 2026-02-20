# German Tax Tracker

Free, open-source tool that helps German tax residents with foreign broker accounts figure out what to report on their annual tax return.

**Live at [germantaxtracker.de](https://germantaxtracker.de)**

## What it does

Enter your fund holdings, dividends, interest, and sales — and get the values you need for your ELSTER tax filing (Anlage KAP and KAP-INV).

It calculates yearly Vorabpauschale on your ETFs/funds, handles pro-rata for mid-year purchases, tracks accumulated VP credits for when you sell, and covers capital gains from stocks, bonds, and derivatives.


## Tech stack

- React 19 + Vite
- Tailwind CSS v4
- Shadcn/ui (Radix UI)
- 100% client-side (localStorage)

## Run locally

```bash
npm install
npm run dev
```

## How the calculations work

See [germantaxtracker.de/how-it-works.html](https://germantaxtracker.de/how-it-works.html)

## Contributing

Started as a side project to solve my own tax filing headaches. The goal is to build free, reliable tax tooling for everyone in the same situation. PRs and issues welcome.

## Disclaimer

This is a calculation aid, not tax advice. Always verify with a Steuerberater. No liability for incorrect filings.

## License

[MIT](LICENSE)
