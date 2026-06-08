/**
 * Cookie Policy. ZooPrep uses only essential, first-party storage — no tracking
 * or advertising cookies — so this is short and honest.
 */
import LegalPage, { LegalSection } from './LegalPage';

const CookiePolicyPage = () => (
  <LegalPage title="Cookie Policy" updated="June 7, 2026">
    <p>
      ZooPrep keeps this simple: we use only the storage we need to run the
      service. We do not use advertising or cross-site tracking cookies.
    </p>

    <LegalSection heading="What we store in your browser">
      <p><strong className="text-ink-body">Sign-in tokens.</strong> We store your ZooPrep login tokens in your browser’s local storage so you stay signed in. Clearing them (or logging out) signs you out.</p>
      <p><strong className="text-ink-body">Preferences.</strong> Small settings like your theme (light/dark) and your acknowledgement of this notice are stored locally so the app remembers them.</p>
      <p><strong className="text-ink-body">Extension settings.</strong> If you use the Bluebook Importer, your ZooPrep connection and delivery preference are stored by the extension in your browser only.</p>
    </LegalSection>

    <LegalSection heading="What we don’t do">
      <p>No third-party advertising cookies, no cross-site tracking, no selling of data. Anything we store is first-party and used only to operate ZooPrep for you.</p>
    </LegalSection>

    <LegalSection heading="Managing it">
      <p>You can clear ZooPrep’s stored data anytime through your browser settings. Note that clearing sign-in tokens will log you out, and clearing preferences will reset things like your theme.</p>
    </LegalSection>
  </LegalPage>
);

export default CookiePolicyPage;
