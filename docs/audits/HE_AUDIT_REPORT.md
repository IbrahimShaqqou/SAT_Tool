# Visual Audit Report: Linear Inequalities in One or Two Variables (H.E.)

**Date:** 2026-05-21  
**Skill Code:** H.E.  
**Skill Name:** Linear inequalities in one or two variables  
**Domain:** Heart of Algebra

---

## Executive Summary

**Total Questions Audited:** 70  
**Questions with Detected Issues:** 15 (21.4%)  
**Issue Types Found:**
- Parsing errors (unclosed/malformed HTML tags): 15 questions

---

## Detailed Findings

### Issues Detected

The following 15 questions have potential HTML parsing issues that may affect rendering:

| # | Question ID | Issue Type | Description |
|---|------------|------------|-------------|
| 3 | `1721196a-ca3b-4b1e-9356-e2da87d5b8c8` | parsing error | Possible unclosed HTML tags (open: 16, close: 12) |
| 6 | `28c54699-758c-492d-9adf-76245f0b9045` | parsing error | Possible unclosed HTML tags (open: 15, close: 11) |
| 9 | `2f9afc7f-72a6-4c6b-acba-9a0eefedf3eb` | parsing error | Possible unclosed HTML tags (open: 19, close: 15) |
| 11 | `351701f2-411f-43ef-8680-fba54dbbe043` | parsing error | Possible unclosed HTML tags (open: 29, close: 22) |
| 21 | `5f766bd8-cf3d-4776-8b31-a6161e8e2d16` | parsing error | Possible unclosed HTML tags (open: 18, close: 14) |
| 24 | `6bed8a1c-4d10-4875-8acf-55634514a991` | parsing error | Possible unclosed HTML tags (open: 18, close: 14) |
| 27 | `713d1d26-6cd4-4fca-aed0-d7d29313edf5` | parsing error | Possible unclosed HTML tags (open: 31, close: 24) |
| 42 | `a1591364-8ee7-4a94-88c8-02039d9ab55f` | parsing error | Possible unclosed HTML tags (open: 23, close: 17) |
| 44 | `a247ffbc-54a6-4040-8ac3-38192c14dea7` | parsing error | Possible unclosed HTML tags (open: 27, close: 22) |
| 47 | `a860feb3-70b7-423f-9585-8965047dc7c0` | parsing error | Possible unclosed HTML tags (open: 19, close: 15) |
| 49 | `aea9b7cb-4f3a-4f26-aca9-6b28f92dc517` | parsing error | Possible unclosed HTML tags (open: 17, close: 13) |
| 56 | `bda2daf7-894b-4a47-aabc-fa0076465287` | parsing error | Possible unclosed HTML tags (open: 25, close: 20) |
| 58 | `c344bb34-97a3-4a39-95cd-791cb1095a15` | parsing error | Possible unclosed HTML tags (open: 20, close: 16) |
| 63 | `daec4b85-07d3-4e5a-9ad1-86315ce951a8` | parsing error | Possible unclosed HTML tags (open: 18, close: 14) |
| 70 | `fef99200-de97-49cb-8878-76bce36182d9` | parsing error | Possible unclosed HTML tags (open: 26, close: 20) |

### Questions Without Issues

**55 questions (78.6%)** passed the automated audit with no detected issues:
- No parsing errors
- No oversized images
- No missing content
- Math rendering appears well-formed

---

## Analysis

### Issue Patterns

1. **HTML Tag Imbalance:** All flagged questions show an imbalance between opening and closing HTML tags. This typically occurs when:
   - MathML or complex math expressions use nested tags
   - Answer choices contain image-based math expressions with wrapper spans
   - Self-closing tags are not properly accounted for

2. **Common Structure:** Many of these questions appear to use `<img>` tags within `<span>` wrappers for rendering mathematical expressions in answer choices.

### Potential Impact

- **Math Rendering:** Unclosed tags may cause:
  - Broken layout
  - Missing or garbled mathematical symbols
  - Incorrect answer choice display
  
- **User Experience:** Visual defects could:
  - Confuse students
  - Make questions unsolvable
  - Affect assessment accuracy

---

## Recommendations

### Immediate Actions

1. **Visual Verification Required:** The 15 flagged questions should be visually inspected in a browser to confirm actual rendering issues.

2. **Priority Questions:** Focus on questions with the largest tag imbalances first:
   - Question #11 (`351701f2-411f-43ef-8680-fba54dbbe043`): 7-tag difference
   - Question #27 (`713d1d26-6cd4-4fca-aed0-d7d29313edf5`): 7-tag difference
   - Question #44 (`a247ffbc-54a6-4040-8ac3-38192c14dea7`): 5-tag difference

3. **HTML Validation:** Run the HTML content of flagged questions through a proper HTML validator to identify specific unclosed tags.

### Long-term Solutions

1. **Content Pipeline:** Implement HTML validation in the question ingestion/import pipeline
2. **Automated Testing:** Add automated visual regression tests for question rendering
3. **Math Rendering:** Consider switching from image-based to MathJax/KaTeX rendering for consistency

---

## Methodology

### Audit Process

1. **Data Source:** `/backend/data/math_norm.json`
2. **Selection Criteria:** All questions with `meta.skill_cd === "H.E."`
3. **Checks Performed:**
   - Math tag completeness
   - Image size validation
   - Content presence verification
   - HTML tag balance analysis
   - Encoding issue detection

### Limitations

- **Static Analysis Only:** This audit examined raw HTML without browser rendering
- **False Positives Possible:** Self-closing tags and MathML structures may trigger false alarms
- **No Image Validation:** External image URLs were not fetched/validated
- **No Visual Confirmation:** Screenshots were not captured for all 70 questions

---

## Files Generated

- `he_audit_results.json` - Initial audit results
- `he_detailed_audit_results.json` - Detailed analysis with all findings
- `HE_AUDIT_REPORT.md` - This comprehensive report

---

## Next Steps

1. ✅ **Completed:** Static HTML analysis of all 70 questions
2. ⏭️ **Recommended:** Visual verification of 15 flagged questions using browser
3. ⏭️ **Recommended:** Fix identified HTML issues in source data
4. ⏭️ **Recommended:** Expand audit to other skill codes

---

*Report generated by automated audit script*  
*For questions or follow-up, refer to detailed JSON results*
