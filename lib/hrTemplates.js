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

export const EMPLOYEE_AGREEMENT = `EMPLOYMENT AGREEMENT

This Employment Agreement (the "Agreement") is entered into on {{effectiveDate}}, between {{companyLegalName}}, having its principal place of business at {{companyAddress}} ("Anandi Productions" or the "Company"), and {{employeeName}} ({{email}}) (the "Employee").

WHEREAS, the parties hereto desire to enter into this Agreement to define and set forth the terms and conditions of the employment of the Employee by the Company;

NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth below, it is hereby covenanted and agreed by the Company and the Employee as follows:

1. DEFINITIONS

(A) In this Agreement, where the context admits:

"Agreement" shall mean this Agreement and all attached annexures and instruments supplemental to or amending, modifying or confirming this Agreement in accordance with its provisions.

"Confidential Information" means any data or information, whether or not expressly marked "confidential", that is of value to the Company and not generally known to the public. Confidential Information shall include any trade or business secret, technical knowledge or know-how, financial information, business or operational plans, strategies, systems, programs, methods, employee lists, computer programs, customer lists, pricing policies and procedures, marketing data, client data, any imagery or compilation of information used in the business of the Company or any of its clients. It shall also include any information received by the Company from any third party under any understanding, express or implied, that it will not be disclosed.

"Handbook" shall mean the Employee Handbook issued by the Company and amended from time to time by the Company's management, which lays down policies, procedures, and guidelines applicable to all employees.

"Intellectual Property" includes ideas, concepts, creations, discoveries, inventions, improvements, know-how, trade or business secrets, service marks, designs, images, photographs, fashion collections, brands, workflows, vendors, location details, databases, estimates, digital workflows, tie-ups, and agreements in either printed or machine-readable form, whether or not copyrightable or patentable.

"Intellectual Property Rights" or "IPRs" over the Intellectual Property include (i) all rights, title, and interest under any statute or common law, including patent rights, copyrights (including moral rights), and any similar rights in respect of Intellectual Property anywhere in the world; (ii) any licenses, permissions, and grants in connection therewith; (iii) applications for registration and the right to apply for registration; (iv) the right to obtain and hold appropriate registrations; (v) all extensions and renewals; and (vi) causes of action in the past, present, or future related thereto, including the right to sue for and recover damages.

(B) Each party represents that it has the authority and is lawfully entitled to enter into this Agreement and is not under any disability, restriction, or prohibition that would prevent it from performing its obligations hereunder.

2. POSITION & EMPLOYMENT PERIOD

2.1 The Company hereby employs the Employee in the capacity of {{jobTitle}}, and the Employee hereby agrees to serve in such capacity for the period commencing {{startDate}} (the "Commencement Date"). This Agreement shall continue until terminated by either party in accordance with Clause 8.

2.2 The first six (6) months of employment shall be treated as a probation period. During the probation period, either party may terminate this Agreement by giving fifteen (15) days' written notice. Upon successful completion of probation, the notice period under Clause 8 shall apply.

3. PERFORMANCE OF DUTIES

3.1 The Employee agrees to perform the duties and responsibilities of the position, as described in the offer letter, job description, or as assigned by the Company, and such other duties as may reasonably be assigned from time to time. The Employee shall perform such duties diligently, in compliance with applicable law and the policies of the Company, and shall devote their full business time, effort, judgment, skill, and knowledge to the advancement of the Company's interests during working hours.

3.2 During the Employment Period, the Employee shall:

(i) Not conduct or support, whether for profit or otherwise, directly or indirectly, any business or research that is related to, competitive with, or similar to the business carried on by the Company;

(ii) Without prior written approval of the Company, not engage in any outside business activities (including accepting any executive responsibility, directorship, partnership, consultancy, secondary employment, or similar position) nor receive any remuneration for work performed from any person other than the Company;

(iii) Work for up to nine (9) hours per day, six (6) days per week, not to exceed forty-eight (48) hours per week in accordance with the Maharashtra Shops and Establishments Act, with at least one designated weekly rest day. Any additional hours beyond this cap shall be treated as overtime and compensated or compensated with time off in lieu, in accordance with Company policy;

(iv) Not act in a manner that is in conflict with or in violation of the Handbook and such other directions as may be issued by the Company from time to time;

(v) Disclose all material and relevant information that may affect the Employee's employment with the Company, currently or in the future, or that may conflict with the terms of this Agreement;

(vi) Not be bound by any other agreements that restrict the Employee from performing their duties under this Agreement;

(vii) Communicate with the Company and its clients strictly through the Company-provided email address and communication channels;

(viii) Not share, replicate, duplicate, or manipulate the Company's confidential details, information, workflows, digital assets, client details, or databases with any third party or the general public.

4. COMPENSATION & BENEFITS

4.1 The Employee shall be compensated as follows:

(a) The Employee shall receive a fixed monthly salary of {{monthlyCtc}} (equivalent to {{annualCtc}} annually), payable on or before the 10th of the following month, subject to applicable statutory deductions. The detailed salary structure (basic, HRA, conveyance, special allowance, etc.) shall be set out in the offer letter or salary annexure;

(b) The Employee shall be entitled to statutory benefits as applicable under law, including (where applicable by statutory thresholds): Provident Fund (EPF) contributions, Employee State Insurance (ESI), Gratuity under the Payment of Gratuity Act 1972 (after five years of continuous service), and Professional Tax;

(c) The Employee shall be entitled to annual leave, sick leave, casual leave, and public holidays in accordance with the Maharashtra Shops and Establishments Act and the Company's Handbook. Minimum annual leave entitlement is twenty-one (21) days per year;

(d) Female employees shall be entitled to maternity leave of twenty-six (26) weeks as per the Maternity Benefit Act, 1961, and any other statutory entitlements thereunder;

(e) Reasonable business expenses incurred with prior written approval shall be reimbursed upon submission of an itemised account, in accordance with the Handbook;

(f) The Employee shall be provided with a Company email address for all client and internal communication.

4.2 All payments made by the Company under this Agreement shall be reduced by any tax or other amounts required to be withheld under applicable law, including TDS under the Income Tax Act, 1961.

5. NON-COMPETE & NON-SOLICITATION

5.1 To protect and preserve the goodwill of the Company, the Employee covenants that during the Employment Period, the Employee shall not be employed by, own any interest in, manage, control, participate in, consult with, render services for, or otherwise engage in any business that is in direct competition with the business of the Company or its affiliates.

(Note: Post-termination non-compete clauses are generally unenforceable in India under Section 27 of the Indian Contract Act, 1872. The restriction in this clause applies only during the Employment Period.)

5.2 During the Employment Period and for a period of 12 (twelve) calendar months after separation from the Company, for any reason, the Employee shall not directly or indirectly:

(a) Induce or attempt to induce any employee, contractor, consultant, partner, customer, or supplier of the Company to leave the employment or services of the Company, or in any way interfere with the relationship between the Company and any such person;

(b) Hire any person who was an employee or contractor of the Company at any time during the three (3) month period immediately prior to the date of such hiring;

(c) Service any person who was a customer, supplier, licensee, licensor, partner, consultant, or other business relation of the Company, in order to induce such person to cease doing business with, or reduce the amount of business conducted with, the Company, or in any way interfere with such relationship.

6. CONFIDENTIALITY

6.1 By signing this Agreement, the Employee agrees that during and after the Employment Period, the Employee shall protect, foster, and respect the confidentiality of all Confidential Information and shall not use or disclose to any person — except as required by applicable law (after providing at least five (5) days' notice to the Company where legally permissible) or as required for the proper performance of the Employee's duties — any Confidential Information obtained incident to the employment or through any other association with the Company. This obligation shall survive termination of this Agreement for a period of five (5) years, or longer where required by law.

7. INTELLECTUAL PROPERTY RIGHTS & IMAGERY COPYRIGHT

7.1 All Intellectual Property developed by the Employee during the course of employment and related to the Company's business or interests ("Employee Inventions") shall be solely owned by the Company. The Employee shall take all steps necessary to perfect the Company's ownership of such rights. All Employee Inventions shall be promptly and fully disclosed and delivered to the Company.

7.2 All imagery and media developed by the Company or on behalf of the Company shall not be used, reproduced, duplicated, or manipulated in any form or media by the Employee. Sole ownership of the copyrights in such imagery vests in the Company (or in the client where ownership has been contractually transferred).

7.3 In the event the Employee accrues any rights in any Employee Inventions, the Employee hereby assigns all such rights to the Company for its absolute use, without any restriction as to time or territory, and shall sign an Employee Invention Assignment Agreement as provided by the Company and attached as Annexure "A".

8. TERMINATION

8.1 Termination by the Employee (no cause): This Agreement may be terminated by the Employee at any time by giving the Company advance written notice of {{noticePeriodMonths}} ({{noticePeriodMonths}}) months.

8.2 Termination by the Company (no cause): This Agreement may be terminated by the Company at any time by giving the Employee advance written notice of {{noticePeriodMonths}} ({{noticePeriodMonths}}) months, or payment in lieu of notice equivalent to the Employee's gross monthly salary multiplied by {{noticePeriodMonths}}.

8.3 Termination by the Company for cause: Notwithstanding anything else in this Agreement, the Company may terminate the employment of the Employee with immediate effect by written notice (without payment in lieu of notice) in the following events:

8.3.1 Misconduct, including but not limited to fraud, dishonesty, breach of integrity, embezzlement, or misappropriation of the Company's property;

8.3.2 Failure to comply with the directions of authorized Company personnel, or conviction of the Employee for any offence involving moral turpitude;

8.3.3 Breach of any terms of the Handbook or this Agreement, irregular attendance, unauthorized absence from work for more than five (5) consecutive working days, or conduct that is prejudicial to the interests of the Company or its clients;

8.3.4 Suppression of material or relevant information required to be disclosed under Clause 3;

8.3.5 Any other material breach of the terms and conditions of this Agreement.

8.4 The Employee acknowledges that the Company would be irreparably injured by a violation of the Non-Compete, Non-Solicitation, Confidentiality, or Intellectual Property Rights clauses under this Agreement, and agrees that the Company shall be entitled to injunctive relief or other appropriate equitable remedies in addition to damages.

8.5 The Employee represents that they are not in breach of any contract or legal obligation owed to any third party (including previous employers) and shall not violate any such obligation during their employment with the Company.

8.6 CONSEQUENCES OF TERMINATION:

(i) Termination by the Employee shall be subject to satisfactory completion of all existing duties, obligations, projects, and assignments, and an orderly handover as directed by the Company;

(ii) Any dues owed by the Employee to the Company (including unpaid loans or advances) shall be adjusted against any amounts due to the Employee from the Company. If amounts owed by the Employee exceed amounts due, the Employee shall pay the balance to the Company;

(iii) Upon termination, the Employee shall return all equipment, materials, and information (including any Confidential Information) provided by or accessed through the Company;

(iv) All originals and copies of material containing, representing, or constituting Intellectual Property produced by the Employee during the Employment Period shall be handed over to the Company immediately upon creation and all copies shall be returned upon termination;

(v) The Company shall process the full and final settlement, including any earned but unpaid salary, leave encashment (where applicable), and gratuity (where applicable), within 45 days of the last working day, subject to lawful deductions.

8.7 LIQUIDATED DAMAGES — NOTICE PERIOD SHORTFALL:

If the Employee terminates this Agreement without serving the full {{noticePeriodMonths}} ({{noticePeriodMonths}}) month notice period under Clause 8.1, the Employee shall pay to the Company, as liquidated damages, an amount equivalent to the Employee's gross monthly salary multiplied by the number of unserved notice months (pro-rated for partial months). This amount represents a genuine pre-estimate of the Company's loss in sourcing, onboarding, training, and transitioning roles, and is not a penalty. The Company may recover this amount from any final settlement, unpaid salary, reimbursements, or other dues payable to the Employee, and the Employee expressly consents to such recovery.

8.8 ADDITIONAL DAMAGES — BREACH OR TERMINATION FOR CAUSE:

In addition to Clause 8.7, if the Employee is terminated for cause under Clause 8.3, or if the Employee materially breaches Clauses 5, 6, or 7, the Employee shall be liable for all direct and consequential damages suffered by the Company, including but not limited to: cost of replacement hiring, training costs, client handover costs, loss of business arising from such departure or breach, and reasonable legal and recovery costs. The Company reserves the right to pursue recovery of such damages through appropriate legal channels in addition to any equitable remedies available under Clause 8.4.

9. AMENDMENT

This Agreement may be amended only by written instrument executed by both parties, with mutually agreed advance notice of not less than two (2) months.

10. NOTICES

Any notice required or permitted to be given under this Agreement shall be in writing and shall be sent by registered post and email to the Company at {{companyAddress}} and {{companyEmail}}, and to the Employee at the last address and email filed with the Company.

11. NON-ASSIGNMENT

The Employee may not assign this Agreement or any interest herein, by operation of law or otherwise, without the prior written consent of the Company.

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

This Agreement, together with its annexures, offer letter, and the Handbook, constitutes the entire agreement between the parties with respect to the subject matter and supersedes all prior or contemporaneous agreements, understandings, negotiations, and communications, whether written or oral.

18. FORCE MAJEURE

Neither party shall be liable for any delay or failure to perform its obligations under this Agreement arising from causes beyond its reasonable control, including acts of God, natural disasters, war, terrorism, government action, pandemics, or labor disputes, provided that the affected party gives prompt notice to the other and uses reasonable efforts to resume performance.

IN WITNESS WHEREOF, the Employee has hereunto set their hand, and the Company has caused this Agreement to be executed in its name and on its behalf, all as of the day and year first above written.

─────────────────────────────────────────────────────────────────

ANNEXURE "A" — EMPLOYEE INVENTION ASSIGNMENT AGREEMENT

1. I, {{employeeName}} ({{email}}), am entering into this Employee Invention Assignment Agreement ("Assignment") as a condition of my employment with {{companyLegalName}}, whether or not I am expected to create inventions of value for the Company.

2. I agree to maintain the quality of my work and be punctual in all deliverables.

3. I agree that the Intellectual Property Rights of all inventions in which I am involved during the Employment Period shall be the sole and exclusive property of the Company, and are hereby irrevocably assigned by me to {{companyLegalName}}.

─────────────────────────────────────────────────────────────────

EMPLOYEE:

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
export const EMPLOYEE_HANDBOOK = `EMPLOYEE & CONTRACTOR HANDBOOK

{{companyLegalName}}
Effective Date: {{effectiveDate}}

─────────────────────────────────────────────────────────────────

PREAMBLE

This Handbook sets out the policies, procedures, and standards of conduct that apply to all employees and independent contractors engaged by {{companyLegalName}} ("Anandi Productions" or the "Company"). It is intended to help every team member understand what is expected of them and what they can expect from the Company in return. This Handbook forms part of the Employment Agreement or Independent Contractor Agreement signed by each team member and should be read together with those agreements.

The Company reserves the right to amend this Handbook from time to time, with reasonable notice to all team members. The latest version shall always prevail.

1. OUR VALUES

We expect every team member to uphold the following values in their daily work:

(i) Professionalism and integrity in all dealings with clients, vendors, and colleagues.
(ii) Respect for confidentiality and the Company's intellectual property.
(iii) Punctuality and commitment to deadlines.
(iv) A collaborative, respectful, and harassment-free work environment.
(v) Ownership of outcomes, not just tasks.

2. EQUAL OPPORTUNITY

The Company is an equal opportunity employer. We do not discriminate on the basis of caste, religion, gender, sexual orientation, marital status, disability, or any other characteristic protected by applicable law. Hiring, promotion, compensation, and termination decisions are made on the basis of merit, skill, and performance.

3. ANTI-HARASSMENT & POSH COMPLIANCE

3.1 The Company maintains a zero-tolerance policy towards harassment of any kind, including sexual harassment, bullying, intimidation, or abusive conduct.

3.2 In accordance with the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 ("POSH Act"), the Company has constituted an Internal Committee ("IC") to receive and address complaints of sexual harassment.

3.3 Internal Committee details:
    Presiding Officer: [TO BE FILLED BY COMPANY]
    Members: [TO BE FILLED BY COMPANY]
    External Member: [TO BE FILLED BY COMPANY]
    Contact: {{companyEmail}}

3.4 Any team member who believes they have been subjected to sexual harassment or has witnessed such behaviour shall report the matter to the IC in writing within three (3) months of the incident. The IC shall investigate the complaint confidentially and in accordance with the POSH Act.

3.5 Retaliation against any person who files a complaint or assists in an investigation is strictly prohibited and will be treated as serious misconduct.

4. CODE OF CONDUCT

Every team member shall:

(i) Treat all colleagues, clients, vendors, and the general public with respect and courtesy.
(ii) Maintain confidentiality of all Company and client information.
(iii) Comply with all applicable laws and Company policies.
(iv) Avoid conflicts of interest and disclose any potential conflicts promptly.
(v) Not consume alcohol, drugs, or any intoxicants during working hours or on Company premises (except as permitted at Company-sanctioned events).
(vi) Not engage in political campaigning or religious proselytizing in the workplace.

5. DRESS CODE & PROFESSIONALISM

5.1 Team members shall dress in a manner appropriate to their role and the professional standards expected of the Company's clients.

5.2 When visiting client premises or attending production sets, team members shall comply with the dress code communicated for that assignment.

5.3 Personal grooming and hygiene shall be maintained at all times.

6. WORKING HOURS

6.1 Standard working hours are nine (9) hours per day, six (6) days per week, with a minimum of one (1) designated weekly rest day, not to exceed forty-eight (48) hours per week in accordance with the Maharashtra Shops and Establishments Act.

6.2 Any work performed beyond the 48-hour weekly cap shall be treated as overtime and compensated in accordance with the applicable salary structure or compensated with time off in lieu, at the Company's discretion.

6.3 Shoot days, travel days, and production schedules may vary. The Company will make reasonable efforts to balance workload across the team.

7. ATTENDANCE & PUNCTUALITY

7.1 All team members shall be punctual and maintain regular attendance. Attendance is tracked via the Company's attendance system (currently Jibble or equivalent).

7.2 Any planned absence (leave) shall be applied for in advance and approved by the reporting manager.

7.3 Unplanned absence (sickness, emergency) shall be communicated to the reporting manager at the earliest opportunity, ideally before the start of the working day.

7.4 Unauthorized absence for more than five (5) consecutive working days may be treated as abandonment of employment and may result in termination for cause.

8. LEAVE POLICY

8.1 ANNUAL LEAVE: Every team member who has completed three (3) months of continuous service is entitled to a minimum of twenty-one (21) days of paid annual leave per calendar year, in accordance with the Maharashtra Shops and Establishments Act. Annual leave is to be applied for at least two (2) weeks in advance, subject to manager approval and project commitments.

8.2 SICK LEAVE: Team members are entitled to seven (7) days of paid sick leave per calendar year. A medical certificate may be required for sick leave exceeding two (2) consecutive days.

8.3 CASUAL LEAVE: Team members are entitled to seven (7) days of paid casual leave per calendar year for personal matters that cannot be scheduled in advance.

8.4 PUBLIC HOLIDAYS: The Company observes public holidays as notified by the Government of Maharashtra and as published in the annual holiday calendar.

8.5 MATERNITY LEAVE: Female team members are entitled to twenty-six (26) weeks of paid maternity leave in accordance with the Maternity Benefit Act, 1961. This includes up to eight (8) weeks of pre-natal leave. Additional entitlements (medical bonus, nursing breaks, crèche facility where applicable) shall be provided as required by law.

8.6 PATERNITY LEAVE: Male team members are entitled to five (5) days of paid paternity leave, to be availed within one (1) month of the birth of the child.

8.7 BEREAVEMENT LEAVE: Up to five (5) days of paid leave on the death of an immediate family member (spouse, parent, child, sibling).

8.8 UNPAID LEAVE: Any leave taken beyond the above entitlements, or without prior approval, shall be treated as leave without pay (LWP) and deducted from the monthly salary on a pro-rata basis.

9. COMPENSATION & PAYROLL

9.1 Salaries and fees are paid monthly on or before the 10th of the following month, subject to applicable statutory deductions (TDS, PF, ESI, Professional Tax, where applicable).

9.2 Reimbursements for approved business expenses shall be processed with the next monthly payroll, subject to submission of valid receipts and manager approval.

9.3 Any grievances regarding compensation shall be raised with the HR administrator (copy: {{companyEmail}}) in writing.

10. CONFIDENTIALITY

10.1 All Company information, client information, production plans, budgets, creative assets, vendor lists, and internal communications are strictly confidential.

10.2 Confidential information shall not be shared with any third party (including family members, friends, or social media) without prior written approval from the Company.

10.3 The confidentiality obligation survives termination of employment or engagement.

11. USE OF COMPANY EQUIPMENT & ASSETS

11.1 Company-provided laptops, cameras, equipment, software licenses, and office supplies shall be used solely for Company business.

11.2 Team members are responsible for the care and security of Company equipment assigned to them. Loss or damage due to negligence may result in recovery of cost from the team member.

11.3 All equipment must be returned on the last working day, in good working condition.

12. IT & DATA SECURITY

12.1 Team members shall use only Company-approved software and cloud services.

12.2 All Company files shall be stored on the designated cloud drives. Personal cloud accounts (personal Google Drive, Dropbox, etc.) shall not be used for Company work.

12.3 Passwords shall not be shared. Multi-factor authentication shall be enabled wherever available.

12.4 Any suspected data breach shall be reported to the Company immediately at {{companyEmail}}.

13. SOCIAL MEDIA & PUBLIC COMMUNICATIONS

13.1 Team members shall not post, share, or publish any Company information, client information, behind-the-scenes imagery, or production details on personal social media without prior written approval.

13.2 Team members shall not make public statements on behalf of the Company unless expressly authorized.

13.3 Personal social media use shall not interfere with work duties.

14. INTELLECTUAL PROPERTY

14.1 All work product, creative output, designs, photographs, videos, edits, scripts, and any other intellectual property developed in the course of employment or engagement is the sole property of the Company (or the client, where ownership has been contractually transferred).

14.2 Team members shall not use, reproduce, or publish any such intellectual property for personal portfolios, showreels, or any other purpose without prior written approval.

15. CONFLICT OF INTEREST

15.1 Team members shall avoid any situation that creates, or appears to create, a conflict between their personal interests and the interests of the Company.

15.2 Any potential conflict (including secondary employment, personal investments in competitors, family relationships with vendors/clients) shall be disclosed to the Company in writing.

16. ANTI-BRIBERY & ANTI-CORRUPTION

16.1 Team members shall not offer, solicit, or accept any bribe, kickback, or improper payment in connection with Company business.

16.2 Gifts from vendors or clients exceeding a nominal value (₹1,000) shall be disclosed to the Company and may be subject to return or handover.

17. WORKPLACE SAFETY

17.1 The Company is committed to providing a safe working environment. Team members shall follow all safety protocols on set, on location, and in the office.

17.2 Any workplace injury, near-miss, or safety hazard shall be reported to the Company immediately.

17.3 First aid supplies and emergency contact numbers shall be maintained at the office.

18. GRIEVANCE REDRESSAL

18.1 Any team member with a grievance (work-related, interpersonal, compensation, harassment, or otherwise) shall raise it with their reporting manager in the first instance.

18.2 If the grievance cannot be resolved at the manager level, or if the grievance concerns the manager, it shall be escalated to the HR administrator at {{companyEmail}}.

18.3 Grievances related to sexual harassment shall be directed to the Internal Committee (see Clause 3).

18.4 All grievances shall be handled confidentially and in good faith.

19. DISCIPLINARY PROCEDURE

19.1 Minor breaches of this Handbook may result in a verbal warning, followed by a written warning if repeated.

19.2 Serious or repeated breaches may result in suspension, demotion, or termination for cause, in accordance with the Employment Agreement or Independent Contractor Agreement.

19.3 The Company shall follow the principles of natural justice — the team member shall be informed of the allegation, given an opportunity to respond, and the decision shall be communicated in writing.

20. RESIGNATION & EXIT

20.1 A team member wishing to resign shall give written notice in accordance with the notice period specified in their agreement ({{noticePeriodMonths}} months).

20.2 During the notice period, the team member shall complete all pending work, hand over ongoing projects, return all Company assets, and participate in an exit interview.

20.3 Full and final settlement (including any earned but unpaid salary, leave encashment where applicable, and gratuity where applicable) shall be processed within forty-five (45) days of the last working day.

21. AMENDMENTS TO HANDBOOK

The Company may amend this Handbook from time to time. Amendments shall be communicated to all team members via email and shall take effect from the date specified in the notification.

22. ACKNOWLEDGEMENT

By signing the Employment Agreement or Independent Contractor Agreement, the team member confirms that they have read, understood, and agree to comply with this Handbook.

─────────────────────────────────────────────────────────────────

CONTACT

For any questions about this Handbook, please contact:

{{companyLegalName}}
{{companyAddress}}
Email: {{companyEmail}}
Phone: {{companyPhone}}

─────────────────────────────────────────────────────────────────

ACKNOWLEDGED BY:

Name:      {{employeeName}}
Email:     {{email}}
Role:      {{jobTitle}}
Signature: _________________________
Date:      _________________________
`;
export const OFFER_LETTER_EMPLOYEE = `OFFER OF EMPLOYMENT

Date: {{effectiveDate}}

To: {{employeeName}}
Email: {{email}}

Dear {{employeeName}},

We are pleased to offer you the position of {{jobTitle}} at {{companyLegalName}}, on the following terms:

1. POSITION: {{jobTitle}}
2. START DATE: {{startDate}}
3. EMPLOYMENT TYPE: Full-time Employee
4. COMPENSATION: {{annualCtc}} per annum ({{monthlyCtc}} per month), subject to applicable statutory deductions (TDS, PF, ESI, Professional Tax where applicable). Detailed salary structure will be provided separately.
5. WORKING HOURS: Nine (9) hours per day, six (6) days per week, not exceeding forty-eight (48) hours per week, with one designated weekly rest day.
6. PROBATION: Six (6) months from the Start Date. During probation, either party may terminate with fifteen (15) days' written notice.
7. NOTICE PERIOD: After successful completion of probation, {{noticePeriodMonths}} months' written notice by either party, or payment in lieu thereof.
8. LEAVE: Twenty-one (21) days annual leave, seven (7) days sick leave, seven (7) days casual leave per calendar year, plus public holidays as per the Company's annual holiday calendar.
9. BENEFITS: Statutory benefits as applicable (PF, ESI, Gratuity after 5 years, Maternity Leave of 26 weeks per the Maternity Benefit Act 1961).
10. REPORTING TO: The Company's management or such person as designated from time to time.
11. LOCATION: Mumbai, India (with travel as required for productions).

This offer is contingent upon:
(a) Submission of valid identity proof, address proof, PAN card, and bank details;
(b) Completion of onboarding documentation;
(c) Signing of the Employment Agreement and acknowledgement of the Employee Handbook.

Please confirm your acceptance by signing below and returning this letter within seven (7) days.

We look forward to having you on the team.

Warm regards,

{{companyOwner}}
{{companyLegalName}}
{{companyAddress}}
{{companyEmail}} | {{companyPhone}}

─────────────────────────────────────────────────────────────────

ACCEPTANCE

I, {{employeeName}}, accept this offer of employment on the terms set out above.

Name:      {{employeeName}}
Signature: _________________________
Date:      _________________________
`;

export const OFFER_LETTER_CONTRACTOR = `ENGAGEMENT LETTER — INDEPENDENT CONTRACTOR

Date: {{effectiveDate}}

To: {{employeeName}}
Email: {{email}}

Dear {{employeeName}},

We are pleased to engage you as an Independent Contractor with {{companyLegalName}}, on the following terms:

1. ROLE: {{jobTitle}}
2. START DATE: {{startDate}}
3. ENGAGEMENT TYPE: Independent Contractor
4. FEES: {{annualCtc}} per annum ({{monthlyCtc}} per month), payable on or before the 10th of the following month, subject to TDS deduction under the Income Tax Act 1961.
5. WORKING HOURS: Up to nine (9) hours per day, six (6) days per week. Contractor retains discretion over work schedule subject to production requirements and deadlines.
6. NOTICE PERIOD: {{noticePeriodMonths}} months' written notice by either party, or payment in lieu thereof.
7. REPORTING TO: The Company's management or such person as designated from time to time.
8. LOCATION: Mumbai, India (with travel as required for productions).

This engagement is contingent upon:
(a) Submission of valid identity proof, PAN card, and bank details;
(b) Completion of onboarding documentation;
(c) Signing of the Independent Contractor Agreement and acknowledgement of the Employee & Contractor Handbook.

Please note: as an Independent Contractor, statutory employee benefits (PF, ESI, Gratuity, paid leave entitlements) do not apply to this engagement. You are responsible for your own tax filings, insurance, and statutory compliance.

Please confirm your acceptance by signing below and returning this letter within seven (7) days.

We look forward to working with you.

Warm regards,

{{companyOwner}}
{{companyLegalName}}
{{companyAddress}}
{{companyEmail}} | {{companyPhone}}

─────────────────────────────────────────────────────────────────

ACCEPTANCE

I, {{employeeName}}, accept this engagement on the terms set out above.

Name:      {{employeeName}}
Signature: _________________________
Date:      _________________________
`;

/**
 * DEFAULT_TEMPLATES — keyed by template slug.
 * Each entry: { title, workerClass ('employee'|'contractor'|'all'), body }
 * 'all' means the template applies to both employee and contractor.
 */
export const DEFAULT_TEMPLATES = {
  contractorAgreement: {
    title: 'Independent Contractor Agreement',
    workerClass: 'contractor',
    body: CONTRACTOR_AGREEMENT,
  },
  employeeAgreement: {
    title: 'Employment Agreement',
    workerClass: 'employee',
    body: EMPLOYEE_AGREEMENT,
  },
  handbook: {
    title: 'Employee & Contractor Handbook',
    workerClass: 'all',
    body: EMPLOYEE_HANDBOOK,
  },
  offerLetterEmployee: {
    title: 'Offer Letter — Employee',
    workerClass: 'employee',
    body: OFFER_LETTER_EMPLOYEE,
  },
  offerLetterContractor: {
    title: 'Engagement Letter — Contractor',
    workerClass: 'contractor',
    body: OFFER_LETTER_CONTRACTOR,
  },
};
