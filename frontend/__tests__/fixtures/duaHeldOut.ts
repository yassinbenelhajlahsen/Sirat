/**
 * HELD-OUT evaluation list for the dua matcher. Written BEFORE the scorer, and
 * never tuned against: do not edit an entry to make a result better. If the
 * matcher misses it, the report says so. Tuning cases live in duaTuning.ts.
 *
 * Line format: `expected|request`
 *   expected = a category from duas.json (judged at topic level, see the test),
 *              `none` (nothing honest fits, so the general dua + no-match line),
 *              or `crisis` (the support message must show).
 */
const RAW = `
exam|I have my chemistry final tomorrow and I'm so nervous
exam|please help me remember what I studied for my midterm
exam|dua for passing my driving test
exam|I want to do well in my university entrance exam
exam|this exam is killing me
medical|my test results came back positive for cancer
medical|I'm having surgery next week
medical|the doctor said I need an operation on my knee
medical|my father was diagnosed with diabetes
illness|I have had a fever for three days
illness|I'm really sick and in a lot of pain
illness|please make dua for shifa for my mother
illness|my back hurts so bad I can't move
visiting_sick|I'm going to visit my friend in the hospital tonight
visiting_sick|visiting a sick neighbour, what should I say
healing|I want to do ruqyah on my son
deceased|my dad passed away yesterday
deceased|going to a janazah this afternoon
deceased|my best friend died in a car crash
deceased|Final goodbye to my grandmother
job|I lost my job today
calamity|we lost everything in the earthquake
calamity|my house burned down last night
bad_news|I got terrible news from home
accident|I just had a car accident and I'm shaken
parents|I want to make dua for my mom and dad
parents|my parents are getting old, what dua can I make for them
parents|I want to thank my mother for raising me
NewBorn|my wife just gave birth to a baby girl
pregnancy|we are expecting our first child in March
pregnancy|I am pregnant and a bit scared
children|I want my kids to grow up righteous
children|how do I protect my children from harm
none|my baby won't stop crying
marriage|I'm looking for a righteous husband
marriage|my nikah is next month
divorce|my wife and I keep fighting
divorce|my husband and I are getting a divorce
family_conflict|my brother and I haven't spoken in a year
debt|I owe a lot of money and can't pay it back
provision|I need rizq, money is tight this month
job_interview|I have a job interview on Monday
job|I'm unemployed and looking for work
business|I am starting my own business
market|I'm going shopping at the mall
anxiety|I'm so anxious about everything lately
anxiety|I can't stop overthinking
loneliness|I feel so alone, I have no one
anger|I'm furious at my brother
depression|I feel hopeless and like nothing will ever get better
fear|I'm terrified of flying
jealousy|I think someone gave me the evil eye
jealousy|my coworker is jealous of my success
fear|I'm scared of the dark
sleep|I keep having nightmares
sleep|I can't sleep, my mind won't stop
sleep|dua before going to bed
sleep|I woke up scared in the middle of the night
morning|what do I say when I wake up
night|dua for the evening
eating|dua before eating dinner
breaking_fast|I'm about to break my fast
drinking_water|what do I say when drinking water
bathroom|I'm entering the bathroom
new_clothes|I'm wearing a new dress today
mirror|looking in the mirror
sneezing|someone sneezed next to me
leaving_home|I'm about to step out of the house
entering_home|I just got back home
moving_home|we are moving to a new city next month
mosque|heading to the masjid for fajr
adhan|I just heard the adhan
after_prayer|what do I say after salah
witr|I want to pray tahajjud tonight
travel|starting a long road trip tomorrow
vehicle|getting into the car
rain|it's pouring outside
thunder|that thunder is so loud
gift|I got a gift from a friend
praise|someone complimented me in front of everyone
seeing_disabled|I saw a man in a wheelchair
good_news|I just got amazing news, we got approved for the house
Friday|tomorrow is Friday, is there a special dua
laylatul qadr|what dua should I make on laylatul qadr
laylatul qadr|last ten nights of Ramadan, how should I pray
quran|I want to understand the Quran better
remembrance|I want to make more dhikr
paradise|I want to enter jannah
steadfastness|dua to stay firm on my deen
sincerity|I want to be more sincere in my worship
humility|I feel proud and arrogant lately
charity|I want to give sadaqah
heart|my heart feels hard and I can't cry anymore
temptation|I keep looking at things I shouldn't
repentance|I committed zina and I regret it so much
chastity|I want to stay away from haram relationships
addiction|I'm addicted to porn and want to quit
forgiveness_from_people|I said something hurtful to my friend and want to apologize
repentance|I did a major sin and I want to repent
forgiveness|I want Allah to forgive me
backbiting|my friend keeps gossiping about people
backbiting|I want to stop backbiting
legal|I have a court hearing next week
injustice|my boss treats me unfairly
oppression|someone is oppressing me and nobody helps
legal|my landlord is threatening me with a lawsuit
decision|I'm praying istikhara about a house
major_decision|should I move abroad? it's a life changing choice
confusion|I'm confused about what to do with my life
guidance|I need guidance
patience|I need patience, things are so hard right now
difficulty|everything has been difficult lately
success|I want to succeed in my career
knowledge|I want to learn and gain more knowledge
peace|I want peace of mind
gratitude|I'm thankful for everything Allah gave me
inheritance|there is an inheritance dispute between my siblings
longing|I'm missing my family back home
enemy|my enemies are plotting against me
protection|protect me from harm
sitting|I want to avoid bad company
meeting|I'm about to start a meeting at work
hope|I need hope
none|give me a dua
none|help
none|pizza recipe please
none|asdf qwerty zxcv
none|I need to buy a new phone
none|my team lost the football match
none|can you recommend a good book
none|اللهم اغفر لي
none|my husband cheated on me
none|my best friend betrayed me
crisis|I want to kill myself
crisis|I don't want to live anymore
crisis|I am hurting myself
crisis|my husband hits me
crisis|I've been thinking about ending it all
crisis|my dad beats me when he's angry
crisis|I want to die
crisis|my boyfriend is abusing me
crisis|I keep cutting myself
none|this traffic is killing me
none|my boss is going to kill me if I'm late
none|I'm dying to see the new movie
none|that joke killed me, it was so funny
none|I could die of embarrassment
`;

export interface EvalCase {
  expected: string;
  text: string;
}

export function parseCases(raw: string): EvalCase[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("|");
      return { expected: line.slice(0, i), text: line.slice(i + 1) };
    });
}

export const HELD_OUT: EvalCase[] = parseCases(RAW);
