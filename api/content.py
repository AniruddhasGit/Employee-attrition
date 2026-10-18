"""Editorial copy served by the API: plain feature names and retention hypotheses.

Hypotheses are framed as things worth testing. The model shows associations, not causes,
and no costs are attached.
"""

FEATURE_LABELS = {
    "BusinessTravel": "Business travel",
    "Department": "Department",
    "EducationField": "Education field",
    "JobRole": "Job role",
    "OverTime": "Overtime",
    "DailyRate": "Daily rate",
    "DistanceFromHome": "Commute distance",
    "Education": "Education level",
    "EnvironmentSatisfaction": "Workplace satisfaction",
    "HourlyRate": "Hourly rate",
    "JobInvolvement": "Job involvement",
    "JobLevel": "Job level",
    "JobSatisfaction": "Job satisfaction",
    "MonthlyIncome": "Monthly income",
    "MonthlyRate": "Monthly rate",
    "NumCompaniesWorked": "Previous employers",
    "PercentSalaryHike": "Last raise",
    "PerformanceRating": "Performance rating",
    "RelationshipSatisfaction": "Relationship satisfaction",
    "StockOptionLevel": "Stock options",
    "TotalWorkingYears": "Career length",
    "TrainingTimesLastYear": "Training",
    "WorkLifeBalance": "Work-life balance",
    "YearsAtCompany": "Tenure",
    "YearsInCurrentRole": "Time in role",
    "YearsSinceLastPromotion": "Time since promotion",
    "YearsWithCurrManager": "Time with manager",
}

HYPOTHESES = {
    "OverTime": {
        "title": "Look at sustained overtime",
        "body": "Overtime is the strongest single signal in this data. Worth testing: "
                "a workload review for teams where overtime is the norm, not the exception.",
    },
    "MonthlyIncome": {
        "title": "Check pay against the role",
        "body": "Lower pay within a job level tracks with leaving. Worth testing: a pay-band "
                "review for roles where people sit at the bottom of their band for long.",
    },
    "StockOptionLevel": {
        "title": "Revisit who gets equity",
        "body": "People with no stock options leave more often here. Worth testing: whether a "
                "small grant changes intent to stay in the groups that currently get none.",
    },
    "JobLevel": {
        "title": "Watch the entry levels",
        "body": "Level-1 roles carry the most risk. Worth testing: clearer progression paths "
                "and earlier first-promotion conversations.",
    },
    "TrainingTimesLastYear": {
        "title": "Keep learning visible",
        "body": "Fewer training sessions go with higher risk. Worth testing: a minimum of two "
                "development opportunities a year, tracked like any other commitment.",
    },
    "BusinessTravel": {
        "title": "Question frequent travel",
        "body": "Frequent travellers leave more. Worth testing: rotation or remote options "
                "for roles where travel has crept up.",
    },
    "YearsSinceLastPromotion": {
        "title": "Notice long gaps between promotions",
        "body": "Long gaps since a promotion can signal a stalled path. Worth testing: a "
                "career conversation when someone passes three years without a move.",
    },
    "JobSatisfaction": {
        "title": "Ask, then act",
        "body": "Low job satisfaction is an early signal. Worth testing: short, regular "
                "pulse questions with a visible follow-up on what changed.",
    },
    "EnvironmentSatisfaction": {
        "title": "Fix the environment basics",
        "body": "Low workplace satisfaction tracks with leaving. Worth testing: asking teams "
                "for the one thing about their workspace or tools they would change.",
    },
    "WorkLifeBalance": {
        "title": "Protect time off",
        "body": "Poor work-life balance raises risk. Worth testing: norms on after-hours "
                "messages and making sure leave actually gets taken.",
    },
    "DistanceFromHome": {
        "title": "Make long commutes optional",
        "body": "Long commutes add risk. Worth testing: hybrid days for people far from "
                "the office.",
    },
    "YearsWithCurrManager": {
        "title": "Support new manager relationships",
        "body": "Short time with a manager goes with higher risk. Worth testing: structured "
                "first-90-day check-ins after any manager change.",
    },
}
