// lib/hrTemplates.js — default HR legal document templates.
//
// ⚠️ LEGAL NOTICE
// ─────────────────────────────────────────────────────────────────────────
// These templates are cleaned-up drafts based on Anandi Productions'
// original source text. They have NOT been reviewed by a lawyer. DO NOT
// have anyone sign these without first having a qualified Indian
// employment lawyer review the final text.
//
// Statutory requirements addressed in spirit:
//   - Maternity Benefit Act, 1961 (26 weeks)
//   - Maharashtra Shops & Establishments Act (48 hr/wk cap, 21d annual leave)
//   - POSH Act, 2013 (Internal Committee placeholder)
//   - Indian Contract Act §27 (non-compete flagged as likely unenforceable)
//   - Indian Contract Act §74 (damages as pre-estimate, not penalty)
//
// These templates are SEEDED into settings/hr.templates on first run, and
// then edited in-app via HR Settings. Producer edits in Firestore always
// win — changing this file only affects new installs or reset templates.
// ─────────────────────────────────────────────────────────────────────────

// Placeholders (see lib/hrRender.js):
// {{employeeName}}, {{email}}, {{jobTitle}}, {{department}}, {{startDate}},
// {{annualCtc}}, {{monthlyCtc}}, {{employmentType}}, {{noticePeriodMonths}},
// {{companyLegalName}}, {{companyAddress}}, {{companyEmail}}, {{companyPhone}},
// {{companyOwner}}, {{effectiveDate}}

export const CONTRACTOR_AGREEMENT = `INDEPENDENT CONTRACTOR AGREEMENT

This Agreement (the "Agreement") is entered into on {{effectiveDate}}, between {{companyLegalName}}, having its principal place of business at {{companyAddress}} ("Anandi Productions" or the "Company"), and {{employeeName}} ({{email}}) (the "Independent Contractor").

WHEREAS, the parties hereto desire to enter into this Agreement to define and set forth the terms and conditions of the engagement of the Independent Contractor by the Company;

NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth below, it is hereby covenanted and agreed by the Company and the Independent Contractor as follows:

1. DEFINITIONS

(A) In this Agreement, where the context admits:

"Agreement" shall mean this Agreement and all attached annexures and instruments supplemental to or amending, modifying or confirming this Agreement in accordance with its provisions.

"Confidential Information" means any data or information, whether or not expressly marked "confidential", that is of value to the Company and not generally known to the public. Confidential Information shall include any trade or business secret, technical knowledge or know-how, financial information, business or operational plans, strategies, systems, programs, methods, contractor lists, computer programs, customer lists, pricing policies and procedures, marketing data, client data, any imagery or compilation of information used in the business of the Company or any of its clients. It shall also include any information received by the Company from any third party under any understanding, express or implied, that it will not be disclosed.

"Handbook" shall mean the Employee/Contractor Handbook issued by the Company and amended from time to time by the Company's management, which lays down policies, procedures, and guidelines applicable to all persons engaged by the Company.

"Intellectual Property" includes ideas, concepts, creations, discoveries, inventions, improvements, know-how, trade or business secrets, service marks, designs, images, photographs, fashion collections, brands, workflows, vendors, location details, databases, estimates, digital workflows, tie-ups, and agreements in either printed or machine-readable form, whether or not copyrightable or patentable.

"Intellectual Property Rights" or "IPRs" over the Intellectual Property include (i) all rights, title, and interest under any statute or common law, including patent rights, copyrights (including moral rights), and any similar rights in respect of Intellectual Property anywhere in the world; (ii) any licenses, permissions, and grants in connection therewith; (iii) applications for registration and the right to apply for registration; (iv) the right to obtain and hold appropriate registrations; (v) all extensions and renewals; and (vi) causes of action in the past, present, or future related thereto, including the right to sue for and recover damages.

(B) Each party represents that it has the authority and is lawfully entitled to enter into this Agreement and is not under any disability, restriction, or prohibition that would prevent it from performing its obligations hereunder.

2. POSITION & ENGAGEMENT PERIOD

2.1 The Company hereby engages the Independent Contractor in the capacity of {{jobTitle}}, and the Independent Contractor hereby agrees to serve in such capacity for the period commencing {{startDate}} (the "Commencement Date"). This Agreement shall continue on a rolling monthly basis until terminated by either party in accordance with Clause 8.

Explanation: The Engagement Period as contemplated in Clause 2.1 includes any probation period agreed between the parties.

3. PERFORMANCE OF DUTIES

3.1 The Independent Contractor agrees to perform the duties and responsibilities of the position, as described in the engagement letter or job description provided by the Company, and such other duties as may reasonably be assigned from time to time. The Contractor shall perform such duties diligently, in compliance with applicable law and the policies of the Company, and shall devote their business time, effort, judgment, skill, and knowledge to the advancement of the Company's interests during scheduled working hours.

3.2 During the Engagement Period, the Independent Contractor shall:

(i) Not conduct or support, whether for profit or otherwise, directly or indirectly, any business or research that is related to, competitive with, or similar to the business carried on by the Company;

(ii) Without prior written approval of the Company, not engage in any outside business activities (including accepting any executive responsibility, directorship, partnership, consultancy, employment, or similar position) nor receive any remuneration for work performed from any person other than the Company;

(iii) Without prior written approval of the Company, not receive any fees or remuneration for any work performed from any person other than the Company;

(iv) Perform duties and work for up to nine (9) hours per day, six (6) days per week, not to exceed forty-eight (48) hours per week in accordance with the Maharashtra Shops and Establishments Act, with at least one designated weekly rest day. Any additional hours beyond this cap shall be treated as overtime and compensated in accordance with Clause 4;

(v) Not act in a manner that is in conflict with or in violation of the Handbook and such other directions as may be issued by the Company from time to time;

(vi) Disclose all material and relevant information that may affect the Contractor's engagement with the Company, currently or in the future, or that may conflict with the terms of this Agreement;

(vii) Not be bound by any other agreements that restrict the Contractor from performing their duties under this Agreement;

(viii) Communicate with the Company and its clients strictly through the Company-provided email address and communication channels;

(ix) Not share, replicate, duplicate, or manipulate the Company's confidential details, information, workflows, digital assets, client details, or databases with any third party or the general public.

4. COMPENSATION

4.1 The Independent Contractor shall be compensated for their services and as consideration for the exclusivity undertakings hereunder as follows:

(a) The Independent Contractor shall receive a fixed monthly remuneration of {{monthlyCtc}} (equivalent to {{annualCtc}} annually), payable on or before the 10th of the following month, subject to applicable statutory deductions. The specific structure may be supplemented by a separate engagement letter or annexure;

(b) The Independent Contractor may incur reasonable expenses with prior written approval from the Company for furthering the Company's business. The Company shall reimburse such business-related expenses upon submission of an itemised account of expenditure, in accordance with the Handbook;

(c) The Contractor shall be entitled to rest days and holidays in accordance with the Company's holiday policy as stated in the Handbook;

(d) The Contractor shall be provided with a Company email address for all client and internal communication;

(e) Compensation may be deducted, with written explanation from the Company, if the Contractor fails to submit work on time or if the quality of work is materially deficient, subject to the principles of natural justice.

4.2 All payments made by the Company under this Agreement shall be reduced by any tax or other amounts required to be withheld under applicable law. All personal tax obligations, including income tax compliance and filing of returns, shall be fulfilled by the Independent Contractor at their own cost.

5. NON-COMPETE & NON-SOLICITATION

5.1 To protect and preserve the goodwill of the Company, the Independent Contractor covenants that during the Engagement Period, the Contractor shall not be employed by, own any interest in, manage, control, participate in, consult with, render services for, or otherwise engage in any business that is in direct competition with the business of the Company or its affiliates.

(Note: Post-termination non-compete clauses are generally unenforceable in India under Section 27 of the Indian Contract Act, 1872. The restriction in this clause applies only during the Engagement Period.)

5.2 During the Engagement Period and for a period of 12 (twelve) calendar months after separation from the Company, for any reason, the Independent Contractor shall not directly or indirectly:

(a) Induce or attempt to induce any employee, contractor, consultant, partner, customer, or supplier of the Company to leave the engagement or services of the Company, or in any way interfere with the relationship between the Company and any such person;

(b) Hire any person who was an employee or contractor of the Company at any time during the three (3) month period immediately prior to the date of such hiring;

(c) Service any person who was a customer, supplier, licensee, licensor, partner, consultant, or other business relation of the Company, in order to induce such person to cease doing business with, or reduce the amount of business conducted with, the Company, or in any way interfere with such relationship.

6. CONFIDENTIALITY

6.1 By signing this Agreement, the Independent Contractor agrees that during and after the Engagement Period, the Contractor shall protect, foster, and respect the confidentiality of all Confidential Information and shall not use or disclose to any person — except as required by applicable law (after providing at least five (5) days' notice to the Company where legally permissible) or as required for the proper performance of the Contractor's duties — any Confidential Information obtained incident to the engagement or through any other association with the Company. This obligation shall survive termination of this Agreement for a period of five (5) years, or longer where required by law.

7. INTELLECTUAL PROPERTY RIGHTS & IMAGERY COPYRIGHT

7.1 All Intellectual Property developed by the Independent Contractor related to the Company's business or interests ("Contractor Inventions") shall be solely owned by the Company. The Contractor shall take all steps necessary to perfect the Company's ownership of such rights. All Contractor Inventions shall be promptly and fully disclosed and delivered to the Company.

7.2 All imagery and media developed by the Company or on behalf of the Company shall not be used, reproduced, duplicated, or manipulated in any form or media by the Contractor. Sole ownership of the copyrights in such imagery vests in the Company (or in the client where ownership has been contractually transferred).

7.3 In the event the Contractor accrues any rights in any Contractor Inventions, the Contractor hereby assigns all such rights to the Company for its absolute use, without any restriction as to time or territory, and shall sign a Contractor Invention Assignment Agreement as provided by the Company and attached as Annexure "A".

8. TERMINATION

8.1 Termination by the Independent Contractor (no cause): This Agreement may be terminated by the Independent Contractor at any time by giving the Company advance written notice of {{noticePeriodMonths}} ({{noticePeriodMonths}}) months.

8.2 Termination by the Company (no cause): This Agreement may be terminated by the Company at any time by giving the Contractor advance written notice of {{noticePeriodMonths}} ({{noticePeriodMonths}}) months, or payment in lieu of notice equivalent to the Contractor's gross monthly remuneration multiplied by {{noticePeriodMonths}}.

8.3 Termination by the Company for cause: Notwithstanding anything else in this Agreement, the Company may terminate the engagement of the Contractor with immediate effect by written notice (without payment in lieu of notice) in the following events:

8.3.1 Misconduct, including but not limited to fraud, dishonesty, breach of integrity, embezzlement, or misappropriation of the Company's property;

8.3.2 Failure to comply with the directions of authorized Company personnel, or conviction of the Contractor for any offence involving moral turpitude;

8.3.3 Breach of any terms of the Handbook or this Agreement, irregular attendance, unauthorized absence from work for more than five (5) consecutive working days, or conduct that is prejudicial to the interests of the Company or its clients;

8.3.4 Suppression of material or relevant information required to be disclosed under Clause 3;

8.3.5 Any other material breach of the terms and conditions of this Agreement.

8.4 The Contractor acknowledges that the Company would be irreparably injured by a violation of the Non-Compete, Non-Solicitation, Confidentiality, or Intellectual Property Rights clauses under this Agreement, and agrees that the Company shall be entitled to injunctive relief or other appropriate equitable remedies in addition to damages.

8.5 The Contractor represents that they are not in breach of any contract or legal obligation owed to any third party (including previous employers) and shall not violate any such obligation during their engagement with the Company.

8.6 CONSEQUENCES OF TERMINATION:

(i) Termination by the Contractor shall be subject to satisfactory completion of all existing duties, obligations, projects, and assignments;

(ii) Any dues owed by the Contractor to the Company (including unpaid loans or advances) shall be adjusted against any amounts due to the Contractor from the Company. If amounts owed by the Contractor exceed amounts due, the Contractor shall pay the balance to the Company;

(iii) Upon termination, the Contractor shall return all equipment, materials, and information (including any Confidential Information) provided by or accessed through the Company;

(iv) All originals and copies of material containing, representing, or constituting Intellectual Property produced by the Contractor during the Engagement Period shall be handed over to the Company immediately upon creation and all copies shall be returned upon termination.

8.7 LIQUIDATED DAMAGES — NOTICE PERIOD SHORTFALL:

If the Independent Contractor terminates this Agreement without serving the full {{noticePeriodMonths}} ({{noticePeriodMonths}}) month notice period under Clause 8.1, the Contractor shall pay to the Company, as liquidated damages, an amount equivalent to the Contractor's gross monthly remuneration multiplied by the number of unserved notice months (pro-rated for partial months). This amount represents a genuine pre-estimate of the Company's loss in sourcing, onboarding, training, and transitioning engagements, and is not a penalty. The Company may recover this amount from any final settlement, unpaid remuneration, reimbursements, or other dues payable to the Contractor, and the Contractor expressly consents to such recovery.

8.8 ADDITIONAL DAMAGES — BREACH OR TERMINATION FOR CAUSE:

In addition to Clause 8.7, if the Contractor is terminated for cause under Clause 8.3, or if the Contractor materially breaches Clauses 5, 6, or 7, the Contractor shall be liable for all direct and consequential damages suffered by the Company, including but not limited to: cost of replacement engagement, training costs, client handover costs, loss of business arising from such departure or breach, and reasonable legal and recovery costs. The Company reserves the right to pursue recovery of such damages through appropriate legal channels in addition to any equitable remedies available under Clause 8.4.

9. AMENDMENT

This Agreement may be amended only by written instrument executed by both parties, with mutually agreed advance notice of not less than two (2) months.

10. NOTICES

Any notice required or permitted to be given under this Agreement shall be in writing and shall be sent by registered post and email to the Company at {{companyAddress}} and {{companyEmail}}, and to the Contractor at the last address and email filed with the Company.

11. NON-ASSIGNMENT

The Independent Contractor may not assign this Agreement or any interest herein, by operation of law or otherwise, without the prior written consent of the Company.

12. SUCCESSORS

This Agreement, together with its schedules and annexures, shall be binding upon and inure to the benefit of the Company and its successors and assigns, and upon any person acquiring (whether by merger, consolidation, purchase of assets, or otherwise) all or substantially all of the Company's assets and business.

13. APPLICABLE LAW & DISPUTE RESOLUTION

This Agreement shall be governed by and construed in accordance with the laws of India. All disputes arising under this Agreement shall be resolved in accordance with the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be Mumbai, Maharashtra. The language of arbitration shall be English.

14. COUNTERPARTS

This Agreement may be executed in two or more counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Electronic or digitally-signed counterparts shall have the same legal effect as physical counterparts.

15. SURVIVAL

The provisions of Clauses 5, 6, 7, 8.7, and 8.8 shall survive the termination of this Agreement.

16. SEVERABILITY

If any provision of this Agreement is held to be invalid, illegal, or unenforceable under applicable law, the remaining provisions shall continue in full force and effect, and the invalid provision shall be deemed modified to the minimum extent necessary to make it enforceable while preserving the parties' original intent.

17. ENTIRE AGREEMENT

This Agreement, together with its annexures and any engagement letter, constitutes the entire agreement between the parties with respect to the subject matter and supersedes all prior or contemporaneous agreements, understandings, negotiations, and communications, whether written or oral.

18. FORCE MAJEURE

Neither party shall be liable for any delay or failure to perform its obligations under this Agreement arising from causes beyond its reasonable control, including acts of God, natural disasters, war, terrorism, government action, pandemics, or labor disputes, provided that the affected party gives prompt notice to the other and uses reasonable efforts to resume performance.

IN WITNESS WHEREOF, the Independent Contractor has hereunto set their hand, and the Company has caused this Agreement to be executed in its name and on its behalf, all as of the day and year first above written.

─────────────────────────────────────────────────────────────────

ANNEXURE "A" — INDEPENDENT CONTRACTOR INVENTION ASSIGNMENT AGREEMENT

1. I, {{employeeName}} ({{email}}), am entering into this Contractor Invention Assignment Agreement ("Assignment") as a condition of my engagement with {{companyLegalName}}, whether or not I am expected to create inventions of value for the Company.

2. I agree to maintain the quality of my work and be punctual in all deliverables.

3. I agree that the Intellectual Property Rights of all inventions in which I am involved during the Engagement Period shall be the sole and exclusive property of the Company, and are hereby irrevocably assigned by me to {{companyLegalName}}.

─────────────────────────────────────────────────────────────────

INDEPENDENT CONTRACTOR:

Name:      {{employeeName}}
Email:     {{email}}
Signature: _________________________
Date:      _________________________


FOR {{companyLegalName}}:

Name:      {{companyOwner}}
Title:     Proprietor / Owner
Signature: _________________________
Stamp:     _________________________
Date:      _________________________

Location:  Mumbai, India
`;

// ── Remaining templates added in subsequent tasks ──────────────────────────

export const EMPLOYEE_AGREEMENT = ``;
export const EMPLOYEE_HANDBOOK = ``;
export const OFFER_LETTER_EMPLOYEE = ``;
export const OFFER_LETTER_CONTRACTOR = ``;
export const DEFAULT_TEMPLATES = {};
