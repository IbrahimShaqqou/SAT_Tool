/**
 * Terms of Service.
 */
import LegalPage, { LegalSection } from './LegalPage';

const TermsPage = () => (
  <LegalPage title="Terms of Service" updated="June 7, 2026">
    <p>
      These terms govern your use of ZooPrep. By creating an account or using the
      service, you agree to them. If you do not agree, please don’t use ZooPrep.
    </p>

    <LegalSection heading="Using ZooPrep">
      <p>ZooPrep provides Digital SAT practice, full-length practice-test review, and tutoring tools. You agree to use it for your own SAT preparation (or, for tutors, to support your students) and not to misuse, disrupt, or attempt to gain unauthorized access to the service.</p>
    </LegalSection>

    <LegalSection heading="Your account">
      <p>You are responsible for keeping your login credentials secure and for activity under your account. Tutors and students are responsible for the appropriateness of any content they share through assignments or feedback.</p>
    </LegalSection>

    <LegalSection heading="College Board content and the Bluebook Importer">
      <p>
        SAT®, PSAT/NMSQT®, and Bluebook™ are trademarks of the College Board.
        ZooPrep is not affiliated with or endorsed by the College Board. The
        Bluebook Importer accesses only your own College Board results, through
        your own signed-in session, at your direction. You agree to use it only
        with your own account and in line with College Board’s terms.
      </p>
    </LegalSection>

    <LegalSection heading="Scores and estimates">
      <p>Where ZooPrep displays an official College Board score from an imported test, that is College Board’s number. Where ZooPrep estimates a score, it is an estimate for study purposes and is not an official result. Practice and predicted scores do not guarantee any outcome on the real SAT.</p>
    </LegalSection>

    <LegalSection heading="Availability and changes">
      <p>We work to keep ZooPrep available and accurate, but the service is provided “as is” without warranties. We may change, suspend, or discontinue features, and we may update these terms; continued use after a change means you accept the updated terms.</p>
    </LegalSection>

    <LegalSection heading="Limitation of liability">
      <p>To the extent permitted by law, ZooPrep is not liable for indirect or incidental damages arising from your use of the service. Nothing here limits rights that cannot be limited by law.</p>
    </LegalSection>

    <LegalSection heading="Contact">
      <p>Questions about these terms? Email <a className="text-brand-700 underline dark:text-brand-300" href="mailto:support@zooprep.com">support@zooprep.com</a>.</p>
    </LegalSection>
  </LegalPage>
);

export default TermsPage;
