// Legal / disclaimer page linked from the demo banner, the disclaimer modal,
// and the site footer. Plain-text MUI typography — no auth required so it is
// reachable from any state.

import React from 'react';
import { Box, Container, Divider, Link as MuiLink, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function LegalPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', py: 6 }}>
      <Container maxWidth="md">
        <Paper elevation={1} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Demo Disclaimer & Terms
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last updated: 2026-05-14
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Section title="1. Nature of this Service">
            <Typography paragraph>
              This site (the &ldquo;Demo&rdquo;) is a publicly accessible
              demonstration of the Pocket Family personal-finance application.
              It is operated for the sole purpose of showcasing the
              application&apos;s features. The Demo is not a financial
              product, financial advice, or a record-keeping system, and no
              fiduciary, advisory, or commercial relationship is created by
              your use of it.
            </Typography>
          </Section>

          <Section title="2. AS-IS, No Warranty">
            <Typography paragraph>
              THE DEMO IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY,
              RELIABILITY, AVAILABILITY, AND NON-INFRINGEMENT. THE OPERATOR
              MAKES NO WARRANTY THAT THE DEMO WILL BE UNINTERRUPTED, ERROR
              FREE, OR FREE OF HARMFUL COMPONENTS.
            </Typography>
          </Section>

          <Section title="3. No Personal or Financial Data">
            <Typography paragraph>
              You must not enter personally identifiable information
              (&ldquo;PII&rdquo;), real financial account numbers, real
              transaction history, government identifiers, health information,
              or any other sensitive or confidential data into the Demo.
              Use only fictional data when exploring the application.
            </Typography>
            <Typography paragraph>
              By using the Demo you acknowledge that anything you enter is
              treated as non-confidential and non-proprietary. The operator
              owes you no duty of confidentiality with respect to such input.
            </Typography>
          </Section>

          <Section title="4. Shared Account, No Privacy">
            <Typography paragraph>
              The Demo runs on a single shared account. Data you create is
              visible to and may be edited or deleted by any other visitor to
              the Demo. You have no expectation of privacy in any data you
              enter.
            </Typography>
          </Section>

          <Section title="5. Daily Data Reset">
            <Typography paragraph>
              All data in the Demo tenant — including any transactions,
              accounts, categories, or budgets you create — is deleted and
              replaced with a fresh sample dataset on a daily basis. Do not
              store anything in the Demo that you wish to retain.
            </Typography>
          </Section>

          <Section title="6. Limitation of Liability">
            <Typography paragraph>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR
              SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING WITHOUT
              LIMITATION LOSS OF DATA, REVENUE, OR PROFITS — ARISING OUT OF OR
              IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE DEMO.
            </Typography>
          </Section>

          <Section title="7. Acceptable Use">
            <Typography paragraph>
              You agree not to (a) attempt to gain unauthorised access to the
              Demo, its backend systems, or any account other than the shared
              demo account; (b) probe, scan, or test the vulnerability of the
              Demo; (c) interfere with or disrupt the Demo or other users; or
              (d) use the Demo to violate any applicable law or regulation.
            </Typography>
          </Section>

          <Section title="8. Indemnification">
            <Typography paragraph>
              You agree to indemnify and hold the operator harmless from any
              claim, demand, loss, or expense, including reasonable legal
              fees, arising out of your breach of these terms or your misuse
              of the Demo.
            </Typography>
          </Section>

          <Section title="9. Changes">
            <Typography paragraph>
              The operator may modify, suspend, or discontinue the Demo at any
              time without notice. These terms may be updated at any time;
              continued use of the Demo after a change constitutes acceptance
              of the revised terms.
            </Typography>
          </Section>

          <Section title="10. Contact">
            <Typography paragraph>
              For questions about the Demo, contact the operator at the email
              address listed on the source repository.
            </Typography>
          </Section>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2">
            <MuiLink component={RouterLink} to="/">
              Back to home
            </MuiLink>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
