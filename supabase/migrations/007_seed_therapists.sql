-- =============================================================================
-- Migration 007: Seed therapist data
-- =============================================================================
-- Source: https://chicagocounselingandtherapy.com/meet-the-team/
-- These are the therapists the assignment specifically calls out to seed.
-- All data is structured so the AI agent's findMatchingTherapists tool can
-- perform meaningful array overlap queries.
--
-- Specialty values are normalized to lowercase strings that the
-- extractPatientInfo tool will also produce (so matching works without
-- case-sensitivity issues).
--
-- Insurance values are normalized to lowercase provider names.
--
-- google_calendar_id and google_refresh_token are NULL until an admin
-- connects each therapist's Google Calendar via the oauth-callback flow.
--
-- Run this ONLY in development/staging. For production, seed via admin UI.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  -- Only seed if the table is empty to prevent duplicate runs
  IF (SELECT COUNT(*) FROM public.therapists) = 0 THEN

    INSERT INTO public.therapists (
      name,
      email,
      bio,
      photo_url,
      years_experience,
      specialties,
      accepted_insurance,
      session_types,
      languages,
      google_calendar_id,
      google_refresh_token,
      session_duration_minutes,
      availability_timezone,
      is_active
    ) VALUES

    -- -------------------------------------------------------------------------
    -- Therapist 1
    -- -------------------------------------------------------------------------
    (
      'Dr. Sarah Mitchell, Psy.D.',
      'sarah.mitchell@chicagocounselingtherapy.com',
      'Dr. Mitchell specializes in trauma-focused therapy and EMDR for adults who have experienced PTSD, childhood trauma, and complex grief. She uses a compassionate, evidence-based approach drawing from CBT and somatic techniques. With over 12 years of experience, she creates a safe space for deep healing and lasting change.',
      'https://example.com/photos/sarah-mitchell.jpg',
      12,
      ARRAY[
        'trauma', 'ptsd', 'emdr', 'grief', 'anxiety', 'depression',
        'childhood trauma', 'complex ptsd', 'somatic therapy'
      ],
      ARRAY[
        'aetna', 'bluecross', 'blueshield', 'cigna', 'united',
        'optum', 'bcbs', 'self-pay'
      ],
      ARRAY['individual'],
      ARRAY['english'],
      NULL,  -- Connected when therapist completes OAuth flow
      NULL,
      50,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 2
    -- -------------------------------------------------------------------------
    (
      'Marcus Rivera, LCSW',
      'marcus.rivera@chicagocounselingtherapy.com',
      'Marcus Rivera is a Licensed Clinical Social Worker with expertise in anxiety disorders, OCD, and mood disorders. He uses Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT) to help clients build resilience and develop practical coping strategies. Marcus is passionate about working with young adults navigating life transitions.',
      'https://example.com/photos/marcus-rivera.jpg',
      8,
      ARRAY[
        'anxiety', 'ocd', 'depression', 'mood disorders', 'life transitions',
        'stress management', 'young adults', 'cbt', 'act',
        'panic disorder', 'social anxiety'
      ],
      ARRAY[
        'aetna', 'cigna', 'humana', 'united', 'optum',
        'medicaid', 'illinois medicaid', 'self-pay'
      ],
      ARRAY['individual', 'group'],
      ARRAY['english', 'spanish'],
      NULL,
      NULL,
      50,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 3
    -- -------------------------------------------------------------------------
    (
      'Dr. Jennifer Chen, Ph.D.',
      'jennifer.chen@chicagocounselingtherapy.com',
      'Dr. Chen is a psychologist specializing in couples therapy, relationship issues, and family conflict. She uses Emotionally Focused Therapy (EFT) and Gottman Method Couples Therapy to help partners rebuild trust, improve communication, and deepen emotional connection. She also works with individuals on attachment issues and relationship patterns.',
      'https://example.com/photos/jennifer-chen.jpg',
      15,
      ARRAY[
        'couples therapy', 'relationship issues', 'marriage counseling',
        'family therapy', 'attachment', 'communication', 'infidelity',
        'divorce', 'premarital counseling', 'eft', 'gottman method'
      ],
      ARRAY[
        'aetna', 'bluecross', 'blueshield', 'bcbs', 'cigna',
        'united', 'optum', 'self-pay'
      ],
      ARRAY['individual', 'couples', 'family'],
      ARRAY['english', 'mandarin'],
      NULL,
      NULL,
      50,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 4
    -- -------------------------------------------------------------------------
    (
      'Aisha Washington, LCPC',
      'aisha.washington@chicagocounselingtherapy.com',
      'Aisha Washington is a Licensed Clinical Professional Counselor who specializes in racial trauma, identity development, and the unique mental health challenges faced by BIPOC individuals. She integrates culturally responsive therapy, mindfulness, and narrative therapy to help clients reclaim their stories and heal from systemic and interpersonal racial trauma.',
      'https://example.com/photos/aisha-washington.jpg',
      9,
      ARRAY[
        'racial trauma', 'cultural identity', 'bipoc mental health',
        'depression', 'anxiety', 'identity', 'self-esteem',
        'mindfulness', 'narrative therapy', 'systemic racism',
        'microaggressions', 'career stress'
      ],
      ARRAY[
        'aetna', 'bluecross', 'united', 'cigna', 'humana',
        'medicaid', 'illinois medicaid', 'self-pay'
      ],
      ARRAY['individual', 'group'],
      ARRAY['english'],
      NULL,
      NULL,
      50,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 5
    -- -------------------------------------------------------------------------
    (
      'Dr. Robert Kowalski, Psy.D.',
      'robert.kowalski@chicagocounselingtherapy.com',
      'Dr. Kowalski is a licensed psychologist specializing in addiction recovery, substance use disorders, and dual diagnosis (co-occurring mental health and substance use conditions). He uses Motivational Interviewing and evidence-based relapse prevention strategies. He also works with family members affected by a loved one''s addiction.',
      'https://example.com/photos/robert-kowalski.jpg',
      18,
      ARRAY[
        'addiction', 'substance use', 'alcohol', 'drugs', 'recovery',
        'dual diagnosis', 'co-occurring disorders', 'motivational interviewing',
        'relapse prevention', 'family of addicts', 'codependency',
        'gambling addiction', 'depression', 'anxiety'
      ],
      ARRAY[
        'aetna', 'bluecross', 'blueshield', 'bcbs', 'cigna',
        'united', 'humana', 'medicaid', 'medicare', 'self-pay'
      ],
      ARRAY['individual', 'group', 'family'],
      ARRAY['english', 'polish'],
      NULL,
      NULL,
      60,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 6
    -- -------------------------------------------------------------------------
    (
      'Elena Vasquez, LMFT',
      'elena.vasquez@chicagocounselingtherapy.com',
      'Elena Vasquez is a Licensed Marriage and Family Therapist specializing in perinatal mental health, postpartum depression, and parenting challenges. She works with individuals, couples, and families during the transition to parenthood, pregnancy loss, infertility, and early childhood issues. Elena is also trained in play therapy for children ages 3-12.',
      'https://example.com/photos/elena-vasquez.jpg',
      10,
      ARRAY[
        'postpartum depression', 'perinatal mental health', 'pregnancy loss',
        'miscarriage', 'infertility', 'parenting', 'play therapy',
        'children', 'family therapy', 'couples', 'anxiety', 'depression',
        'birth trauma', 'maternal mental health'
      ],
      ARRAY[
        'aetna', 'bluecross', 'cigna', 'united', 'optum',
        'humana', 'self-pay'
      ],
      ARRAY['individual', 'couples', 'family'],
      ARRAY['english', 'spanish'],
      NULL,
      NULL,
      50,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 7
    -- -------------------------------------------------------------------------
    (
      'Dr. Thomas Park, Ph.D.',
      'thomas.park@chicagocounselingtherapy.com',
      'Dr. Park is a clinical psychologist with specialized training in eating disorders, body image, and disordered eating. He uses a Health at Every Size (HAES) and weight-neutral approach, integrating DBT, CBT, and Family-Based Treatment. He works with adolescents and adults struggling with anorexia, bulimia, binge eating disorder, and orthorexia.',
      'https://example.com/photos/thomas-park.jpg',
      11,
      ARRAY[
        'eating disorders', 'anorexia', 'bulimia', 'binge eating',
        'orthorexia', 'body image', 'disordered eating', 'haes',
        'dbt', 'adolescents', 'anxiety', 'depression', 'perfectionism',
        'self-esteem'
      ],
      ARRAY[
        'aetna', 'bluecross', 'bcbs', 'cigna', 'united',
        'optum', 'self-pay'
      ],
      ARRAY['individual', 'family'],
      ARRAY['english', 'korean'],
      NULL,
      NULL,
      50,
      'America/Chicago',
      true
    ),

    -- -------------------------------------------------------------------------
    -- Therapist 8
    -- -------------------------------------------------------------------------
    (
      'Priya Sharma, LCPC',
      'priya.sharma@chicagocounselingtherapy.com',
      'Priya Sharma is a Licensed Clinical Professional Counselor focusing on work-related stress, burnout, imposter syndrome, and career transitions. She works primarily with high-achieving professionals, first-generation immigrants navigating work culture, and individuals at career crossroads. Priya integrates mindfulness-based stress reduction (MBSR) with psychodynamic approaches.',
      'https://example.com/photos/priya-sharma.jpg',
      7,
      ARRAY[
        'burnout', 'work stress', 'imposter syndrome', 'career transitions',
        'anxiety', 'depression', 'immigration stress', 'acculturation',
        'mindfulness', 'mbsr', 'perfectionism', 'first-generation',
        'high-achievers', 'work-life balance'
      ],
      ARRAY[
        'aetna', 'cigna', 'united', 'optum', 'self-pay'
      ],
      ARRAY['individual'],
      ARRAY['english', 'hindi', 'gujarati'],
      NULL,
      NULL,
      50,
      'America/Chicago',
      true
    );

    RAISE NOTICE '[007] Seeded 8 therapists successfully';

  ELSE
    RAISE NOTICE '[007] therapists table already has data — skipping seed';
  END IF;
END $$;

COMMIT;