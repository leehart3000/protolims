// Who runs this ProtoLIMS site, and where it's hosted, for its About and Privacy pages. These
// are protolims.org's; anyone running ProtoLIMS elsewhere sets their own here (the pages'
// wording otherwise fits any site).
export const SITE = {
  // Who runs the site, and decides how personal data here is used (the data controller).
  operator: 'Lee Hart',
  // How they run it, completing "This site is run by Lee Hart, …".
  operatorDetail: 'personally, as a non-commercial project in the UK',
  // Where to send privacy questions and requests.
  contactEmail: 'privacy@protolims.org',
  // Where the site's source code is (the AGPL asks for it to be offered).
  sourceUrl: 'https://github.com/leehart3000/protolims',
  // Who processes personal data for the site, and what for.
  processors: [
    { name: 'Cloudflare', role: 'serves the website, from its global network, and forwards email' },
    { name: 'Google Cloud', role: 'runs the application and keeps backups, in London' },
    { name: 'Neon', role: 'hosts the database, on AWS in London' },
    {
      name: 'GitHub',
      role: 'runs the nightly backup check, in the US; the backup copy used there is deleted when the check ends',
    },
    { name: 'ORCID', role: 'confirms who you are when you sign in' },
  ],
  // How long backups and the hosts' own logs are kept.
  backupDays: 30,
  logsKept: "for the providers' standard periods; Google Cloud keeps its logs for 30 days",
  // Where to complain about how personal data is handled.
  regulator: { name: "the Information Commissioner's Office", url: 'https://ico.org.uk' },
  // When the privacy notice last changed.
  privacyUpdated: '1 November 2026',
}
