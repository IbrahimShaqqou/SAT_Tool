/**
 * Privacy Policy. Also serves as the privacy policy URL for the Chrome Web Store
 * listing of the ZooPrep Bluebook Importer extension.
 */
import LegalPage, { LegalSection } from './LegalPage';

const PrivacyPolicyPage = () => (
  <LegalPage title="Privacy Policy" updated="June 7, 2026">
    <p>
      This policy explains what information ZooPrep collects, how we use it, and
      the choices you have. It covers the ZooPrep website and the ZooPrep Bluebook
      Importer browser extension.
    </p>

    <LegalSection heading="Who we are">
      <p>
        ZooPrep is a Digital SAT practice and tutoring platform for students and
        the tutors who work with them. If you have questions about this policy,
        contact us at <a className="text-brand-700 underline dark:text-brand-300" href="mailto:privacy@zooprep.com">privacy@zooprep.com</a>.
      </p>
    </LegalSection>

    <LegalSection heading="Information we collect">
      <p><strong className="text-ink-body">Account information.</strong> When you sign up we collect your name, email, role (student or tutor), and any profile details you provide, such as a target score or test date.</p>
      <p><strong className="text-ink-body">Practice data.</strong> Your answers to practice questions, scores, per-skill mastery, study plans, and the assignments a tutor gives you.</p>
      <p><strong className="text-ink-body">Imported College Board results.</strong> If you use the Bluebook Importer, we receive your official Bluebook practice-test results — your scores and your answer to each question — from College Board, and store them in your ZooPrep account.</p>
      <p><strong className="text-ink-body">Basic technical data.</strong> Standard server logs (e.g. request times and error reports) used to operate and secure the service.</p>
    </LegalSection>

    <LegalSection heading="How the Bluebook Importer handles your data">
      <p>
        The importer extension runs only on{' '}
        <span className="whitespace-nowrap">mypractice.collegeboard.org</span> and
        reads your results from College Board's own results API using the session
        you are already signed into. Your College Board session token is used in
        the page to fetch your results and is <strong className="text-ink-body">never stored by the
        extension and never sent to ZooPrep</strong>.
      </p>
      <p>
        Your assembled results are then either uploaded to your ZooPrep account
        (using a connection you explicitly authorize from ZooPrep) or downloaded
        as a file you choose to import. The extension collects nothing else, runs
        no analytics, and contains no remote code.
      </p>
    </LegalSection>

    <LegalSection heading="How we use your information">
      <p>We use your information only to provide the service: to show your scores and progress, generate your study plan, let your tutor see your work, and operate and improve the platform. We do not sell your information, and we do not use it for advertising.</p>
    </LegalSection>

    <LegalSection heading="Who can see your data">
      <p>Your practice data is visible to you and, if you are working with a tutor, to that tutor. We share data with service providers who host and run ZooPrep (for example, our cloud and database providers) only as needed to operate the service, and with no one else except where required by law.</p>
    </LegalSection>

    <LegalSection heading="Data retention and your choices">
      <p>We keep your data while your account is active. You can request a copy of your data or ask us to delete your account by emailing <a className="text-brand-700 underline dark:text-brand-300" href="mailto:privacy@zooprep.com">privacy@zooprep.com</a>. Uninstalling the extension clears the connection settings it stored in your browser.</p>
    </LegalSection>

    <LegalSection heading="Students under 18">
      <p>ZooPrep is used by high-school students. We collect only what is needed for SAT practice and tutoring. If you are under 18, please use ZooPrep with the involvement of a parent, guardian, or tutor.</p>
    </LegalSection>

    <LegalSection heading="Changes">
      <p>We may update this policy; we will revise the “last updated” date above when we do. Significant changes will be communicated in the app.</p>
    </LegalSection>
  </LegalPage>
);

export default PrivacyPolicyPage;
