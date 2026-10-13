import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { selectBalancedQuestions } from "@/lib/question-selection";

describe("Dataset Integrity & Air-Gap Compliance", () => {
  const publicPath = path.join(process.cwd(), "data", "cricket_public_questions.json");
  const answerKeyPath = path.join(process.cwd(), "server", "data", "cricket_answer_key.json");
  const qualityReportPath = path.join(process.cwd(), "data", "cricket_data_quality_report.json");

  it("ensures public questions file exists and has 60 five-question rounds", () => {
    expect(fs.existsSync(publicPath)).toBe(true);
    const pub = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
    expect(pub.rounds).toBeDefined();
    expect(pub.rounds.length).toBe(60);
  });

  it("ensures every round contains exactly 5 questions (300 questions total)", () => {
    const pub = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
    const allIds: string[] = [];

    pub.rounds.forEach((round: any, idx: number) => {
      expect(round.date).toBeDefined();
      expect(round.questions.length).toBe(5);
      round.questions.forEach((q: any) => {
        expect(q.id).toBeDefined();
        expect(q.prompt).toBeDefined();
        expect(q.difficulty).toBeDefined();
        expect(q.category).toBeDefined();
        allIds.push(q.id);
      });
    });

    expect(allIds.length).toBe(300);
    expect(new Set(allIds).size).toBe(300); // All IDs strictly unique
  });

  it("verifies air-gap security: zero answers or coordinates in public file", () => {
    const pubContent = fs.readFileSync(publicPath, "utf-8");
    const pub = JSON.parse(pubContent);

    const forbiddenKeys = [
      "answer",
      "location_name",
      "city",
      "physical_country",
      "latitude",
      "longitude",
      "story",
      "evidence",
      "audit_note",
    ];

    pub.rounds.forEach((round: any) => {
      round.questions.forEach((q: any) => {
        forbiddenKeys.forEach((key) => {
          expect(q[key]).toBeUndefined();
        });
      });
    });
  });

  it("ensures every public question maps to a valid answer in the server answer key", () => {
    expect(fs.existsSync(answerKeyPath)).toBe(true);
    const pub = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
    const answerKey = JSON.parse(fs.readFileSync(answerKeyPath, "utf-8"));

    pub.rounds.forEach((round: any) => {
      round.questions.forEach((q: any) => {
        const answer = answerKey[q.id];
        expect(answer).toBeDefined();
        expect(typeof answer.latitude).toBe("number");
        expect(typeof answer.longitude).toBe("number");
        expect(answer.latitude).toBeGreaterThanOrEqual(-90);
        expect(answer.latitude).toBeLessThanOrEqual(90);
        expect(answer.longitude).toBeGreaterThanOrEqual(-180);
        expect(answer.longitude).toBeLessThanOrEqual(180);
        expect(answer.location_name || answer.answer).toBeTruthy();
      });
    });
  });

  it("keeps source-backed factual corrections synchronized and private", () => {
    const pub = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
    const answerKey = JSON.parse(fs.readFileSync(answerKeyPath, "utf-8"));
    const publicById = new Map<
      string,
      { prompt: string; verification: { eventSourceUrl: string; venueSourceUrl: string; locationSourceUrl: string } }
    >(
      pub.rounds
        .flatMap((round: any) => round.questions)
        .map(
          (question: any) =>
            [question.id, question] as [
              string,
              { prompt: string; verification: { eventSourceUrl: string; venueSourceUrl: string; locationSourceUrl: string } },
            ]
        )
    );
    const getPublicQuestion = (id: string) => {
      const question = publicById.get(id);
      if (!question) throw new Error(`Public question ${id} is missing.`);
      return question;
    };

    expect(getPublicQuestion("P001").prompt).not.toContain("giving Pakistan");
    expect(answerKey.P001.question).toBe(getPublicQuestion("P001").prompt);
    expect(getPublicQuestion("P028").prompt).not.toContain("giving Pakistan");
    expect(answerKey.P028.question).toBe(getPublicQuestion("P028").prompt);
    expect(answerKey.P028.year).toBe(1996);
    expect(answerKey.P028.latitude).toBeCloseTo(31.5133615, 6);
    expect(answerKey.P028.longitude).toBeCloseTo(74.3334644, 6);

    expect(answerKey.W001.location_name).toBe("Antigua Recreation Ground");
    expect(answerKey.W001.city).toBe("St. John's");
    expect(answerKey.W001.latitude).toBeCloseTo(17.122408, 6);
    expect(answerKey.W001.longitude).toBeCloseTo(-61.8390534, 6);
    expect(answerKey.W001.story).not.toContain("Kensington Oval");
    expect(answerKey.W001.question).toBe(getPublicQuestion("W001").prompt);

    for (const id of ["SL001", "SL003"]) {
      expect(answerKey[id].location_name).toBe("Galle International Stadium");
      expect(answerKey[id].city).toBe("Galle");
      expect(answerKey[id].year).toBe(2010);
      expect(answerKey[id].latitude).toBeCloseTo(6.0315586, 6);
      expect(answerKey[id].longitude).toBeCloseTo(80.2160326, 6);
      expect(answerKey[id].question).toBe(getPublicQuestion(id).prompt);
    }
    for (const id of ["P001", "P028", "W001", "W003", "SL001", "SL003"]) {
      expect(getPublicQuestion(id).verification.eventSourceUrl).toBeTruthy();
      expect(getPublicQuestion(id).verification.venueSourceUrl).toBeTruthy();
      expect(getPublicQuestion(id).verification.locationSourceUrl).toBeTruthy();
      expect(answerKey[id].verification_status).toBe("Verified");
    }
  });

  it("enforces the published 300-question balance and verification report", () => {
    expect(fs.existsSync(qualityReportPath)).toBe(true);
    const report = JSON.parse(fs.readFileSync(qualityReportPath, "utf-8"));
    expect(report.summary.totalQuestions).toBe(300);
    expect(report.summary.verifiedQuestions).toBe(6);
    expect(report.summary.unresolvedQuestions).toBe(294);
    expect(report.qualityChecks).toMatchObject({
      totalQuestions: true,
      exactlyThirtyFeatured: true,
      exactlyThirtyAnswerGroups: true,
      uniqueIds: true,
      validCoordinates: true,
      verifiedMetadata: true,
      publicAirGap: true,
      uniqueFiveQuestionRounds: true,
    });
  });

  it("reports verified corrections, duplicates, and unresolved public claims", () => {
    const auditPath = path.join(process.cwd(), "data", "cricket_question_audit_report.json");
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
    expect(audit.summary).toMatchObject({
      totalQuestions: 300,
      verifiedQuestions: 6,
      correctedQuestions: 6,
      duplicatePromptGroups: 14,
      unresolvedQuestions: 294,
    });
    expect(audit.unresolvedQuestions).toHaveLength(294);
    expect(audit.locationCoordinateCorrections).toHaveLength(26);
    expect(audit.relatedDuplicateGroups).toContainEqual(
      expect.objectContaining({ questionIds: ["P001", "P028"] })
    );
    expect(audit.correctedQuestions.map((question: { id: string }) => question.id).sort()).toEqual([
      "P001",
      "P028",
      "SL001",
      "SL003",
      "W001",
      "W003",
    ]);
    expect(
      audit.unresolvedQuestions.every(
        (question: { answer?: unknown; latitude?: unknown }) =>
          question.answer === undefined && question.latitude === undefined
      )
    ).toBe(true);
  });

  it("rotates all ten teams evenly across ten consecutive five-question games", () => {
    const pub = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
    const pool = pub.rounds.flatMap((round: any) => round.questions);
    const appearances: Record<string, number> = {};
    const seen: string[] = [];
    for (let game = 0; game < 10; game += 1) {
      const selection = selectBalancedQuestions(pool, game, seen);
      expect(selection).toHaveLength(5);
      expect(new Set(selection.map((q) => q.id)).size).toBe(5);
      expect(new Set(selection.map((q) => q.featuredTeam)).size).toBe(5);
      selection.forEach((q) => {
        appearances[q.featuredTeam! ] = (appearances[q.featuredTeam! ] || 0) + 1;
        seen.push(q.id);
      });
    }
    expect(Object.values(appearances).every((count) => count === 5)).toBe(true);
    for (let game = 0; game < 10; game += 1) {
      expect(
        selectBalancedQuestions(pool, game)
          .map((question) => question.difficulty)
          .sort()
      ).toEqual(["Easy", "Easy", "Hard", "Hard", "Medium"]);
    }
  });
});
