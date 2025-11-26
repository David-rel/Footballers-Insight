# Database Schema Documentation

This document outlines the complete database schema for the Footballers Insight platform, including all tables, relationships, and their purposes within the 5-step player development system.

## Table of Contents

1. [Core Identity & Access](#core-identity--access)
2. [Teams & Membership](#teams--membership)
3. [Testing Layer (Step 1)](#testing-layer-step-1)
4. [Embeddings & Vectors (Steps 2-3)](#embeddings--vectors-steps-2-3)
5. [Training & Regression (Step 4)](#training--regression-step-4)
6. [AI Analysis & Practice Plans (Step 5)](#ai-analysis--practice-plans-step-5)

---

## Core Identity & Access

### Company

Represents a soccer organization, club, or academy. This is the top-level entity that contains all teams, users, and data.

**Relationships:**

- One Company → Many Teams
- One Company → Many CompanyMemberships
- One Company → Many CompanyAIAnalyses

**Key Fields:**

- `id` - Unique identifier
- `name` - Company/club name
- `slug` or `domain` - URL-friendly identifier
- `createdAt`, `updatedAt` - Timestamps

---

### User

Represents an individual user account in the system. This is the authentication entity that can belong to multiple companies with different roles.

**Relationships:**

- One User → Many CompanyMemberships (can be in multiple companies)
- One User → One PlayerProfile (if role includes PLAYER)
- One User → One CoachProfile (if role includes COACH)

**Key Fields:**

- `id` - Unique identifier
- `email` - Login email
- `passwordHash` - Encrypted password (or OAuth tokens)
- `name` - Full name
- `avatar` - Profile picture URL (optional)
- `phone` - Contact number (optional)

**Note:** The User table does not directly store role information. Roles are determined through CompanyMembership relationships.

---

### CompanyMembership

Junction table that connects users to companies with specific roles. Enables multi-company support where a user can have different roles in different organizations.

**Relationships:**

- `companyId` → Company (many-to-one)
- `userId` → User (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `companyId` - Foreign key to Company
- `userId` - Foreign key to User
- `role` - Enum: `OWNER`, `ADMIN`, `COACH`, `PLAYER`
- `createdAt`, `updatedAt` - Timestamps

**Use Cases:**

- Determine what data a user can access
- Control permissions and feature visibility
- Support users who work with multiple clubs

---

### PlayerProfile

Extended profile information for users who are players. Contains soccer-specific data that's separate from authentication.

**Relationships:**

- `userId` → User (one-to-one, conditional on role)
- `companyId` → Company (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `userId` - Foreign key to User
- `companyId` - Foreign key to Company
- `dateOfBirth` - Age calculation
- `preferredFoot` - LEFT, RIGHT, or BOTH
- `primaryPosition` - Player's main position
- `jerseyNumber` - Team jersey number (optional)
- Additional player-specific metadata

**Note:** Only created when a user's role includes PLAYER in at least one CompanyMembership.

---

### CoachProfile

Extended profile information for users who are coaches. Contains coaching-specific data and credentials.

**Relationships:**

- `userId` → User (one-to-one, conditional on role)
- `companyId` → Company (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `userId` - Foreign key to User
- `companyId` - Foreign key to Company
- `licenses` - Coaching certifications
- `bio` - Professional biography
- `notes` - Internal notes about the coach

**Note:** Only created when a user's role includes COACH in at least one CompanyMembership.

---

## Teams & Membership

### Team

Represents a specific team within a company. This is the primary organizational unit for grouping players and coaches together.

**Relationships:**

- `companyId` → Company (many-to-one)
- One Team → Many TeamCoaches
- One Team → Many TeamPlayers
- One Team → Many TrainingSessions
- One Team → Many TeamAIAnalyses
- One Team → Many PracticePlans

**Key Fields:**

- `id` - Unique identifier
- `companyId` - Foreign key to Company
- `name` - Team name (e.g., "2016 Girls Black")
- `ageGroup` - Age category
- `competitionLevel` - Competitive tier
- `season` - Current season identifier
- `createdAt`, `updatedAt` - Timestamps

---

### TeamCoach

Junction table connecting coaches to teams. Tracks which coaches are assigned to which teams and their specific roles on that team.

**Relationships:**

- `teamId` → Team (many-to-one)
- `coachId` → User (many-to-one, must be a coach)

**Key Fields:**

- `id` - Unique identifier
- `teamId` - Foreign key to Team
- `coachId` - Foreign key to User (coach)
- `role` - Enum: `HEAD`, `ASSISTANT`
- `startDate` - When assignment began
- `endDate` - When assignment ended (nullable)

**Use Cases:**

- Determine which coaches can view/edit team data
- Track coaching assignments over time
- Support coaches moving between teams

---

### TeamPlayer

Junction table connecting players to teams. Tracks roster membership with temporal data to handle players moving between teams without losing historical context.

**Relationships:**

- `teamId` → Team (many-to-one)
- `playerId` → User (many-to-one, must be a player)

**Key Fields:**

- `id` - Unique identifier
- `teamId` - Foreign key to Team
- `playerId` - Foreign key to User (player)
- `startDate` - When player joined team
- `endDate` - When player left team (nullable)

**Use Cases:**

- Track which players belong to which teams
- Maintain historical roster data
- Support players moving between teams during a season

---

## Testing Layer (Step 1)

### TestDefinition

Master table defining the 13 different test types used in the system. This is typically seeded once and rarely changes.

**Relationships:**

- One TestDefinition → Many FeatureDefinitions

**Key Fields:**

- `id` - Unique identifier
- `name` - Test name (e.g., "Shot Power", "Serve Distance", "Figure 8", "Passing Gates")
- `description` - Detailed explanation of the test
- `defaultWeights` - Default PS/TC/MS/DC weights (optional)

**Examples:**

- Shot Power Test
- Serve Distance Test
- Figure 8 Agility Test
- Passing Gates Test
- Core Strength Test
- And 8 more test types...

---

### FeatureDefinition

Defines the 39 individual features that are measured across all tests. These features are used to build the player DNA embedding vector.

**Relationships:**

- `testId` → TestDefinition (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `testId` - Foreign key to TestDefinition
- `key` - Programmatic identifier (e.g., "shot_power_strong_avg")
- `displayName` - Human-readable name
- `isHigherBetter` - Boolean indicating if higher values are better (for normalization)

**Examples:**

- `shot_power_strong_avg` - Average shot power (strong foot)
- `shot_power_strong_max` - Maximum shot power (strong foot)
- `figure8_loops_both` - Figure 8 loops completed
- `agility_5_10_5_best_time` - Best 5-10-5 agility time
- `core_plank_hold_sec` - Plank hold duration in seconds
- And 34 more features...

**Total:** Exactly 39 features across all 13 tests.

---

### PlayerTestSession

Represents a single testing event for a player on a specific date. This is the container for all test results from one testing session.

**Relationships:**

- `playerId` → PlayerProfile (many-to-one)
- `teamId` → Team (many-to-one, optional - the team they were with at test time)
- One PlayerTestSession → Many PlayerTestResults
- One PlayerTestSession → One PlayerDNAEmbedding
- One PlayerTestSession → One PlayerClusterVector
- One PlayerTestSession → Many PlayerAIAnalyses

**Key Fields:**

- `id` - Unique identifier
- `playerId` - Foreign key to PlayerProfile
- `teamId` - Foreign key to Team (optional)
- `date` - Date of the test session
- `location` - Where testing occurred (optional)
- `notes` - Additional context (optional)
- `createdAt`, `updatedAt` - Timestamps

**Use Cases:**

- Track when players were tested
- Group all test results from a single day
- Provide temporal context for player development

---

### PlayerTestResult

Stores individual feature measurements from a test session. Each test session generates up to 39 of these records (one per feature).

**Relationships:**

- `sessionId` → PlayerTestSession (many-to-one)
- `featureId` → FeatureDefinition (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `sessionId` - Foreign key to PlayerTestSession
- `featureId` - Foreign key to FeatureDefinition
- `rawValue` - Original measurement (meters, mph, seconds, etc.)
- `normalizedValue` - Normalized value between 0 and 1 (after min/max scaling)
- `createdAt` - Timestamp

**Use Cases:**

- Store raw test measurements
- Maintain historical performance data
- Feed into embedding calculations

**Note:** Not all features may have values for every session (some features might be optional or not applicable to all players).

---

## Embeddings & Vectors (Steps 2-3)

### PlayerDNAEmbedding

Stores the 39-dimensional embedding vector for a player at a specific test session. This is the mathematical representation of a player's complete performance profile.

**Relationships:**

- `playerId` → PlayerProfile (many-to-one)
- `testSessionId` → PlayerTestSession (one-to-one)

**Key Fields:**

- `id` - Unique identifier
- `playerId` - Foreign key to PlayerProfile
- `testSessionId` - Foreign key to PlayerTestSession
- `vector` - JSON array of 39 floating-point values (the DNA embedding)
- `createdAt` - When embedding was calculated

**Mathematical Representation:**

- This is the `z_{i,t}` vector from the documentation
- Represents player `i` at time `t` in 39-dimensional space
- Used for similarity calculations and clustering

**Use Cases:**

- Compare players across all 39 features simultaneously
- Track how a player's DNA changes over time
- Feed into cluster vector calculations

---

### PlayerClusterVector

Stores the 4-dimensional cluster vector representing a player's position in the PS/TC/MS/DC space at a specific test session.

**Relationships:**

- `playerId` → PlayerProfile (many-to-one)
- `testSessionId` → PlayerTestSession (one-to-one)
- One PlayerClusterVector → Many PlayerClusterDeltas (as "from" side)
- One PlayerClusterVector → Many PlayerClusterDeltas (as "to" side)

**Key Fields:**

- `id` - Unique identifier
- `playerId` - Foreign key to PlayerProfile
- `testSessionId` - Foreign key to PlayerTestSession
- `ps` - Physical Speed component (0-1)
- `tc` - Technical Control component (0-1)
- `ms` - Mental Strength component (0-1)
- `dc` - Decision Making component (0-1)
- `createdAt` - When vector was calculated

**Mathematical Representation:**

- This is the `c_{i,t}` vector from the documentation
- Represents player `i` at time `t` in 4-dimensional cluster space
- Derived from the 39D DNA embedding through dimensionality reduction

**Use Cases:**

- Visualize players on the PS/TC/MS/DC graph
- Track player development in each dimension
- Generate AI insights about player strengths/weaknesses

---

### PlayerClusterDelta

Stores the change in cluster vector components between two test sessions. This enables fast queries about player improvement without recalculating deltas on-the-fly.

**Relationships:**

- `playerId` → PlayerProfile (many-to-one)
- `fromTestSessionId` → PlayerTestSession (many-to-one)
- `toTestSessionId` → PlayerTestSession (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `playerId` - Foreign key to PlayerProfile
- `fromTestSessionId` - Foreign key to PlayerTestSession (starting point)
- `toTestSessionId` - Foreign key to PlayerTestSession (ending point)
- `deltaPs` - Change in Physical Speed
- `deltaTc` - Change in Technical Control
- `deltaMs` - Change in Mental Strength
- `deltaDc` - Change in Decision Making
- `createdAt` - When delta was calculated

**Use Cases:**

- Quickly query "who improved most in TC this month?"
- Track improvement rates across dimensions
- Generate progress reports

**Note:** This table is optional - deltas can be calculated on-the-fly from PlayerClusterVector, but pre-storing them improves query performance for analytics.

---

## Training & Regression (Step 4)

### TrainingSession

Represents a single practice session for a team. This is the container for all training activities that occurred during one practice.

**Relationships:**

- `teamId` → Team (many-to-one)
- One TrainingSession → Many TrainingBlocks
- One TrainingSession → Many PracticePlans (or linked from PracticePlan)

**Key Fields:**

- `id` - Unique identifier
- `teamId` - Foreign key to Team
- `date` - Date of the practice
- `title` - Session title (e.g., "Finishing and 1v1")
- `objective` - Main goal of the session
- `createdBy` - Foreign key to User (coach who created it)
- `createdAt`, `updatedAt` - Timestamps

**Use Cases:**

- Log what happened in practice
- Track training frequency
- Provide context for regression analysis

---

### TrainingBlock

Represents a discrete chunk of activity within a training session. A single session typically contains multiple blocks (e.g., warmup, technical work, small-sided games).

**Relationships:**

- `sessionId` → TrainingSession (many-to-one)
- One TrainingBlock → Many TrainingParticipations
- One TrainingBlock → Many PracticePlanItems (if linking plans to actual blocks)

**Key Fields:**

- `id` - Unique identifier
- `sessionId` - Foreign key to TrainingSession
- `category` - Enum: `FINISHING`, `ONE_V_ONE`, `RONDO`, `AGILITY`, `CONDITIONING`, etc.
- `minutes` - Duration of the block
- `description` - What was done in this block
- `orderIndex` - Position within the session
- `createdAt` - Timestamp

**Examples:**

- Block 1: 15 minutes, rondos
- Block 2: 20 minutes, 1v1 channels
- Block 3: 15 minutes, 5v5 game

**Use Cases:**

- Break down sessions into analyzable components
- Aggregate training time by category
- Feed into regression models

---

### TrainingParticipation

Junction table tracking which players participated in which training blocks. This enables precise tracking of individual player training loads.

**Relationships:**

- `trainingBlockId` → TrainingBlock (many-to-one)
- `playerId` → PlayerProfile (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `trainingBlockId` - Foreign key to TrainingBlock
- `playerId` - Foreign key to PlayerProfile
- `minutes` - Actual minutes participated (may be less than block minutes if player left early or groups were split)
- `createdAt` - Timestamp

**Use Cases:**

- Answer "How many minutes of TC-heavy work did player X do between tests?"
- Calculate individual training loads
- Provide accurate input for regression models

**Note:** The `minutes` field allows for partial participation (e.g., player only did 10 minutes of a 15-minute block).

---

### RegressionSample

Stores training windows between two test sessions for machine learning model training. This table contains the input-output pairs used to train regression models that predict player development.

**Relationships:**

- `playerId` → PlayerProfile (many-to-one)
- `startTestSessionId` → PlayerTestSession (many-to-one)
- `endTestSessionId` → PlayerTestSession (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `playerId` - Foreign key to PlayerProfile
- `startTestSessionId` - Foreign key to PlayerTestSession (beginning of training window)
- `endTestSessionId` - Foreign key to PlayerTestSession (end of training window)
- `inputJson` - JSON containing:
  - Starting 39D DNA embedding
  - Starting 4D cluster vector
  - Aggregated training minutes per category
- `deltaDNAJson` - JSON containing the change in DNA embedding
- `deltaClusterJson` - JSON containing the change in cluster vector
- `createdAt` - When sample was generated

**Mathematical Representation:**

- Input: `f(startProfile, trainingSummary)`
- Output: `deltaProfile`
- Used to train models that predict how training affects player development

**Use Cases:**

- Train machine learning models offline
- Predict player development based on training plans
- Validate training effectiveness

**Note:** This table can also store references to aggregated TrainingSession/TrainingBlock data for additional context.

---

## AI Analysis & Practice Plans (Step 5)

### PlayerAIAnalysis

Stores AI-generated analysis and insights about a specific player at a specific test session snapshot. This provides narrative context to complement the numerical data.

**Relationships:**

- `playerId` → PlayerProfile (many-to-one)
- `testSessionId` → PlayerTestSession (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `playerId` - Foreign key to PlayerProfile
- `testSessionId` - Foreign key to PlayerTestSession
- `summary` - JSON or markdown containing the AI analysis
- `prompt` - The prompt used to generate analysis (optional, for traceability)
- `model` - AI model used (optional)
- `createdAt` - When analysis was generated

**Use Cases:**

- Show coaches narrative insights about players
- Track how analysis changes over time
- Provide context for player development decisions

**Note:** Multiple analyses can exist for the same test session if re-generated with different prompts or models.

---

### TeamAIAnalysis

Stores AI-generated analysis and insights about an entire team. Provides a high-level overview of team strengths, weaknesses, and composition.

**Relationships:**

- `teamId` → Team (many-to-one)
- `testSessionId` → PlayerTestSession (many-to-one, optional - snapshot date)

**Key Fields:**

- `id` - Unique identifier
- `teamId` - Foreign key to Team
- `testSessionId` - Foreign key to PlayerTestSession (optional, for snapshot context)
- `summary` - JSON or markdown containing the team analysis
- `date` - Date of the analysis snapshot
- `createdAt` - When analysis was generated

**Use Cases:**

- Provide team-level insights (e.g., "Team is strong in PS, low in TC especially passing gates")
- Help coaches understand team composition
- Support team selection and strategy decisions

---

### CompanyAIAnalysis

Stores AI-generated analysis and insights about an entire company/club. Provides organization-wide insights for directors and owners.

**Relationships:**

- `companyId` → Company (many-to-one)

**Key Fields:**

- `id` - Unique identifier
- `companyId` - Foreign key to Company
- `summary` - JSON or markdown containing the company analysis
- `date` - Date of the analysis snapshot
- `createdAt` - When analysis was generated

**Use Cases:**

- Dashboard view for company owners/directors
- Organization-wide performance trends
- Resource allocation insights

---

### PracticePlan

Represents a planned practice session, often generated by AI but can also be created by coaches or a mix of both. This is what coaches view and execute during practice.

**Relationships:**

- `teamId` → Team (many-to-one)
- One PracticePlan → Many PracticePlanItems

**Key Fields:**

- `id` - Unique identifier
- `teamId` - Foreign key to Team
- `date` - Planned date for the practice
- `title` - Plan title
- `source` - Enum: `AI`, `COACH`, `MIXED`
- `aiPromptId` - Reference to prompt used (optional)
- `aiContext` - Context provided to AI (optional)
- `createdAt`, `updatedAt` - Timestamps

**Use Cases:**

- Coaches view plans on their phones during practice
- Track what was planned vs. what was executed
- Generate AI recommendations for practice content

---

### PracticePlanItem

Represents a single block or activity within a practice plan. These items can optionally be linked to actual TrainingBlocks if the plan was executed.

**Relationships:**

- `planId` → PracticePlan (many-to-one)
- `trainingBlockId` → TrainingBlock (many-to-one, optional - if plan item was executed)

**Key Fields:**

- `id` - Unique identifier
- `planId` - Foreign key to PracticePlan
- `orderIndex` - Position within the plan
- `blockType` - Enum: `WARMUP`, `TECHNICAL`, `SMALL_SIDED`, `GAME`, `FINISHER`, etc.
- `description` - What to do in this block
- `minutes` - Planned duration
- `trainingBlockId` - Foreign key to TrainingBlock (if executed)
- `createdAt` - Timestamp

**Use Cases:**

- Break down practice plans into actionable items
- Link planned activities to actual training execution
- Enable regression models to see connections between plans and outcomes

**Note:** This is where Step 5 (AI Analysis & Practice Plans) meets Step 4 (Training & Regression). When a plan item gets executed, linking it to a TrainingBlock allows the regression system to understand the connection between planned activities and actual training outcomes.

---

## Relationship Summary

### One-to-Many Relationships

- **Company** → Teams, CompanyMemberships, CompanyAIAnalyses
- **User** → CompanyMemberships, PlayerProfile (1:1 conditional), CoachProfile (1:1 conditional)
- **Team** → TeamCoaches, TeamPlayers, TrainingSessions, TeamAIAnalyses, PracticePlans
- **TestDefinition** → FeatureDefinitions
- **PlayerTestSession** → PlayerTestResults, PlayerDNAEmbedding (1:1), PlayerClusterVector (1:1), PlayerAIAnalyses
- **TrainingSession** → TrainingBlocks
- **TrainingBlock** → TrainingParticipations, PracticePlanItems
- **PracticePlan** → PracticePlanItems

### Many-to-Many Relationships (via Junction Tables)

- **User ↔ Company** (via CompanyMembership)
- **Team ↔ User (Coach)** (via TeamCoach)
- **Team ↔ User (Player)** (via TeamPlayer)
- **TrainingBlock ↔ PlayerProfile** (via TrainingParticipation)

### Optional/Nullable Relationships

- **PlayerTestSession.teamId** - Optional (player may not be on a team at test time)
- **TeamPlayer.endDate** - Nullable (current team memberships)
- **TeamCoach.endDate** - Nullable (current coaching assignments)
- **PracticePlanItem.trainingBlockId** - Optional (plan item may not have been executed yet)

---

## Data Flow Through the System

1. **Step 1 (Testing):** Players are tested → Results stored in `PlayerTestResult` → Grouped by `PlayerTestSession`

2. **Step 2 (DNA Embedding):** Test results → Calculated into 39D `PlayerDNAEmbedding` vectors

3. **Step 3 (Cluster Vectors):** DNA embeddings → Reduced to 4D `PlayerClusterVector` (PS/TC/MS/DC)

4. **Step 4 (Training & Regression):** Training sessions logged → Aggregated by category → Stored in `RegressionSample` with deltas → Used to train ML models

5. **Step 5 (AI Analysis):** All data above → Fed to AI → Generates `PlayerAIAnalysis`, `TeamAIAnalysis`, `CompanyAIAnalysis`, and `PracticePlan` recommendations

---

## Notes

- All tables should include `createdAt` and `updatedAt` timestamps for audit trails
- Foreign key relationships should be properly indexed for query performance
- Consider soft deletes for historical data preservation
- The system supports multi-tenancy through the Company hierarchy
- Temporal data (startDate/endDate) enables historical tracking without data loss
