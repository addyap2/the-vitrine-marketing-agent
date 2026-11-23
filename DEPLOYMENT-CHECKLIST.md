# Deployment checklist — Free edition

- [ ] Create private GitHub repo `addyap2/the-vitrine-marketing-agent`
- [ ] Upload project files, excluding node_modules, .next and out
- [ ] Run `npm install && npm run lint && npm run build`
- [ ] Confirm static output in `out/`
- [ ] Choose a free static host that permits your business use; Vercel Hobby eligibility must be checked
- [ ] Deploy static site; no environment variables needed
- [ ] Test Claude prompt copying and pasting response into studio
- [ ] Create a campaign and draft; export JSON backup and test restore
- [ ] Verify mobile layout and that content remains after browser reload
- [ ] Avoid entering sensitive customer data in local browser storage
- [ ] Publish content manually after review