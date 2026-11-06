/**
 * TUNING list for the dua matcher. Unlike duaHeldOut.ts, rules are free to be
 * adjusted until these pass. Same line format: `expected|request`.
 */
import { parseCases, type EvalCase } from "./duaHeldOut";

const RAW = `
exam|I have a math exam on Thursday
exam|dua for studying for my finals
exam|my midterm is tomorrow morning
exam|I'm taking the ielts next week
exam|pop quiz today, help
exam|please help me pass my driving test
exam|revising for my gcse papers
exam|studying for the bar exam
medical|they found a tumor in my scan results
medical|I am about to go into surgery
medical|the surgeon is operating on my dad today
medical|my mom starts chemo next week
medical|I got my biopsy results back
medical|waiting on the doctor's diagnosis
illness|I have a bad migraine
illness|my daughter has a high fever
illness|I've been sick for a week
illness|my stomach ache won't go away
illness|dua for a sore throat
healing|I want to read ruqyah for myself
healing|please heal my grandmother
healing|dua for recovery after my illness
visiting_sick|I'm visiting a sick relative
visiting_sick|going to visit my uncle in the hospital
visiting_sick|visiting a patient tomorrow
deceased|my uncle died last night
deceased|attending a funeral today
deceased|my grandfather passed away this morning
deceased|burial is tomorrow
deceased|what to say at the janazah
loss|I lost my mother last month
loss|I lost my best friend
loss|I am grieving my brother
loss|mourning the loss of my husband
calamity|a flood destroyed our village
calamity|there was a huge fire and we lost our home
calamity|the earthquake destroyed everything
bad_news|I just heard some awful news
bad_news|we got sad news this morning
bad_news|terrible news about my job
accident|I was in a car accident
accident|a crash on the highway scared me
accident|my brother had a collision
good_news|great news, I got engaged
good_news|I got promoted today
good_news|I just got accepted to university
good_news|happy news: we're having a celebration
parents|dua for my parents please
parents|my mom and dad are everything to me
parents|they raised me, how can I repay them
parents|I miss being raised by my mum and dad
pregnancy|my wife is pregnant
pregnancy|we're expecting a baby soon
pregnancy|trying to conceive for two years
pregnancy|I had a miscarriage
pregnancy|we cannot have a baby
NewBorn|my daughter was just born
NewBorn|we welcomed a baby boy
NewBorn|congratulations, you had a baby
NewBorn|aqiqah for my newborn
children|keep my children safe
children|protect my kids from the evil eye
children|I worry about my daughter's safety, protect my daughter
family|I want righteous children
family|help me raise my kids well
family|I want my children to be pious
marriage|I want to get married soon
marriage|dua for a righteous wife
marriage|looking for a husband who fears Allah
marriage|my wedding is this weekend
marriage|nikah ceremony tomorrow
divorce|we are thinking about divorce
divorce|my marriage is falling apart
divorce|going through a divorce
divorce|my husband and I are separated
divorce|talaq has been given
divorce|problems in my marriage
family_conflict|big family drama at home
family_conflict|my sister and I are not speaking to each other
family_conflict|I had a fight with my brother
family_conflict|my mother in law and I don't get along
family_conflict|family problems are exhausting me
inheritance|my siblings are fighting over the inheritance
inheritance|dividing the family property
inheritance|my father's estate
debt|I'm in debt
debt|I can't pay my loan
debt|I owe people money
debt|my mortgage is crushing me
debt|credit card debt
provision|I need halal rizq
provision|we are struggling financially
provision|I'm broke
provision|dua for barakah in my income
provision|poverty is hard
job|I got fired
job|I'm unemployed
job|I need a job
job|I have been laid off
job|looking for work
job_interview|interview tomorrow
job_interview|nervous about my interview
job_interview|I have two interviews this week
business|I want to start a business
business|my startup needs customers
business|dua for profit in my business
business|opening a shop next month
market|going to the market
market|I'm shopping for groceries
market|heading to the supermarket
market|at the bazaar
anxiety|I'm having a panic attack
anxiety|so much stress at work
anxiety|I feel overwhelmed
anxiety|my anxiety is out of control
anxiety|I keep overthinking everything
worry|I'm worried about the future
worry|so much grief and sadness
worry|worrying all the time
worry|dua for distress
fear|I'm afraid of what comes next
fear|terrified of public speaking
fear|I'm scared of dogs
fear|dua for fear
depression|I'm depressed
depression|I feel numb
depression|nothing matters anymore
depression|my heart is broken
depression|I feel worthless
loneliness|I feel lonely
loneliness|I have no friends here
loneliness|nobody understands me
loneliness|I am so isolated
longing|I miss my mother
longing|homesick
longing|longing for my family
longing|I miss him so much
anger|I'm so angry right now
anger|dua to control my anger
anger|I lost my temper with my kids
anger|furious
anger|I am irritated all the time
jealousy|someone put the evil eye on me
jealousy|I think I have hasad on me
jealousy|people are envious of my family
jealousy|nazar on my child
difficulty|life is hard right now
difficulty|going through a tough time
difficulty|I'm struggling
difficulty|hardship after hardship
patience|dua for sabr
patience|I need to be patient
patience|give me patience with my kids
steadfastness|help me stay firm on my religion
steadfastness|my iman is low
steadfastness|istiqamah
steadfastness|I want to stay consistent in prayer
guidance|please guide me
guidance|I need clarity about my path
guidance|show me the right path
guidance|hidayah
confusion|I feel so helpless
confusion|I'm so lazy and procrastinating
confusion|I have no motivation
confusion|I am a coward
decision|istikhara for a job offer
decision|I can't decide between two options
decision|torn between two choices
decision|making a decision about a car
major_decision|big decision about my future
major_decision|should I quit my job and start over
major_decision|moving to another country is a life changing step
major_decision|I'm at a crossroads
consultation|I need advice from someone wise
consultation|seeking counsel about a problem
consultation|I want to consult a scholar
hope|I need some hope
hope|I've lost hope
hope|dua for optimism
hope|help me think good of Allah
peace|I want inner peace
peace|dua for tranquility
peace|peace of mind please
peace|seeking serenity
gratitude|I'm so grateful
gratitude|alhamdulillah for everything
gratitude|dua to be thankful
gratitude|counting my blessings
gift|someone gave me a gift
gift|jazakallahu khayran
gift|a friend helped me move, how do I thank them
gift|received a birthday present
praise|someone praised my work
praise|people keep complimenting me
praise|I was flattered by their words
seeing_disabled|I saw a person in a wheelchair
seeing_disabled|I saw someone disabled
seeing_disabled|saw a blind man crossing the road
protection|protect me from shaytan
protection|I seek refuge in Allah
protection|waswasa won't leave me
protection|I think there's a jinn in my house
protection|protect me from black magic
protection|intrusive thoughts bother me
enemy|my enemy is trying to ruin me
enemy|people are plotting against me
enemy|I'm being bullied
enemy|someone who hates me
oppression|I'm being oppressed
oppression|zulm against my family
oppression|I was wronged
injustice|racism at my workplace
injustice|I was falsely accused
injustice|this is so unfair
injustice|wrongfully blamed
legal|I'm going to court
legal|I need a lawyer
legal|I was arrested
legal|custody hearing
forgiveness|I want to ask Allah for forgiveness
forgiveness|forgive my sins
forgiveness|I feel so guilty
forgiveness|astaghfirullah
repentance|I want to make tawbah
repentance|I committed a major sin
repentance|how to repent
repentance|I did something haram and want to return to Allah
forgiveness_from_people|I need to apologize to my sister
forgiveness_from_people|I want to make amends
forgiveness_from_people|reconcile with my friend
forgiveness_from_people|I hurt someone I love
temptation|I'm tempted to sin
temptation|help me lower my gaze
temptation|I can't resist the urge
temptation|my desires are strong
chastity|help me stay pure
chastity|I'm afraid of falling into zina
chastity|chastity
addiction|I'm addicted to gambling
addiction|I can't quit smoking
addiction|I relapsed
addiction|trying to stop drinking alcohol
addiction|bad habits I can't break
backbiting|I keep backbiting
backbiting|gossip at work
backbiting|people are slandering me
backbiting|ghibah
humility|I'm becoming arrogant
humility|dua for humility
humility|I feel superior to others
humility|kibr
sincerity|I want ikhlas
sincerity|I'm worried about riya
sincerity|purify my intention
sincerity|sincerity in my deeds
charity|I want to give charity
deceased|sadaqah for my late father
charity|zakat this year
charity|donating to the mosque
heart|my heart has become hard
heart|I want khushu in prayer
heart|soften my heart
heart|I can't cry anymore
remembrance|I want to do more dhikr
remembrance|dua to remember Allah always
remembrance|zikr
quran|I want to memorize the Quran
quran|recite surah
quran|tajweed practice
quran|reading the Quran tonight
knowledge|I want to seek knowledge
knowledge|increase me in knowledge
knowledge|ilm
success|I want success
success|help me achieve my goals
success|victory and prosperity
success|dua for excellence
paradise|I want Jannah
paradise|dua for a good ending
paradise|save me from hellfire
paradise|firdaus
mosque|entering the mosque
mosque|leaving the masjid
mosque|I'm going to the masjid
adhan|I'm hearing the adhan
adhan|azan is playing
adhan|what to reply to the call to prayer
after_prayer|dua after salah
after_prayer|I finished praying
after_prayer|what to recite after prayer
witr|witr prayer dua
witr|qunut
witr|waking up for qiyam
witr|last third of the night prayer
laylatul qadr|laylatul qadr dua
laylatul qadr|night of power
laylatul qadr|lailatul qadr tonight
laylatul qadr|shab e qadr
Friday|jummah blessings
Friday|durood on Friday
Friday|it's Friday today
breaking_fast|iftar time
breaking_fast|breaking my fast now
breaking_fast|about to break fast
eating|before I eat
eating|dua after eating
eating|about to eat lunch
eating|finished eating
drinking_water|drinking water
drinking_water|I'm thirsty
drinking_water|a glass of water
bathroom|going to the toilet
bathroom|leaving the restroom
bathroom|washroom
mirror|looking in the mirror
mirror|I feel ugly
mirror|I'm insecure about my looks
new_clothes|new clothes for Eid
new_clothes|wearing a new shirt
new_clothes|got a new abaya
sneezing|I sneezed
sneezing|what to say after sneezing
sneezing|bless you
sitting|bad company is hurting my faith
sitting|avoiding bad friends
sitting|I want good company
meeting|end of a meeting
meeting|a gathering tonight
meeting|going into a meeting
morning|good morning
morning|waking up
morning|morning adhkar
morning|when the sun rises
night|dua for the evening
night|after maghrib
night|sunset
sleep|I can't fall asleep
sleep|I have insomnia
sleep|bedtime dua
sleep|nightmares every night
sleep|before I go to bed
sleep|waking up at night
sleep|lying down to sleep
sleep|tossing and turning all night
travel|I'm traveling tomorrow
travel|my flight is in the morning
travel|going on hajj
travel|umrah next month
travel|on a long journey
travel|back from my trip
vehicle|getting in the car
vehicle|on the bus
vehicle|taking a taxi
vehicle|riding a motorcycle
entering_home|I just got home
entering_home|entering my house
entering_home|arrived home
leaving_home|leaving the house
leaving_home|I'm heading out
leaving_home|stepping out of my home
moving_home|we're moving house
moving_home|relocating to a new apartment
moving_home|housewarming
moving_home|buying a house
rain|it's raining
rain|drought in our area
rain|a downpour started
thunder|I hear thunder
thunder|lightning is flashing
thunder|thunderstorm tonight
none|my phone is missing
none|I lost my keys
none|what's the weather tomorrow
none|best pizza recipe
none|tell me a joke
none|how do I fix my wifi
none|the bus is late
none|I'm bored
none|just testing
none|hello
none|my baby is crying all night
betrayal|my husband cheated on me
betrayal|my friend betrayed me
none|I feel jealous of my sister
none|I forgot my wallet
none|can you recommend a movie
none|my cat is missing
none|I love football
none|a recipe for biryani
none|I broke my phone screen
none|my boss yelled at me
none|اللهم ارحمني
none|ربنا آتنا في الدنيا حسنة
none|مرحبا
none|☺️🙏
crisis|I want to kill myself
crisis|I'm thinking about suicide
crisis|I don't want to be alive anymore
crisis|I wish I was dead
crisis|I've been cutting myself
crisis|I am going to end my life
crisis|there is no reason to live
crisis|everyone would be better off without me
crisis|my husband beats me
crisis|my father hits me every day
crisis|my boyfriend threatened me
crisis|I'm being abused
crisis|my uncle touches me
crisis|I'm afraid of my husband
crisis|he wants to kill me
crisis|she hits me
crisis|I want to hurt myself
crisis|I can't go on
crisis|انتحار
crisis|زوجي يضربني
none|this homework is killing me
none|my mom is going to kill me if I fail
none|I'm dying to see you
none|I could die of embarrassment
none|I'm dead tired
none|that dress is to die for
none|I was scared to death
none|I'm bored to death
none|he hit the ball
none|I'll cut myself some slack
exam|studing for my midterm
anxiety|im so anxios
anxiety|so stresed
loneliness|im lonley
depression|I feel depresed
marriage|looking for a righteus husband
pregnancy|I am pregnent
protection|protecton from shaytan
sleep|nightmears
sleep|insomia
travel|going on a jorney
forgiveness|forgivness please
gratitude|im gratful
healing|shifa for my father
healing|shifaa
protection|hidayah and protection from waswas
guidance|hidaya please
jealousy|nazar lag gayi
protection|jinns are bothering me
protection|shaitan whispers to me
laylatul qadr|laylatulqadr
Friday|juma mubarak
mosque|going to masjed
adhan|adzan
repentance|toba
repentance|taubah
temptation|nafs is strong, urges everywhere
steadfastness|dua for istiqamah on deen
sincerity|ikhlaas
none|ok
exam|I hav an exma tommorow
illness|I have a fevar
none|asdfgh
none|1234
none|.
medical|my dad's test results show cancer
medical|blood test results are bad, the doctor said I need surgery
exam|final exam results tomorrow
deceased|final goodbye to my uncle
deceased|my mom passed away
deceased|my grandma died
parents|my parents are in my dua
debt|I owe money and cannot afford rent
none|my team lost
none|we lost the game
wind|a huge wind is shaking the house
wind|strong winds outside tonight, I am scared
wind|the wind is howling and the windows are rattling
wudu|dua after wudu
wudu|I just made wudu, what do I say
wudu|finished my ablution
in_prayer|what do I say in sujood
in_prayer|what should I say during ruku
in_prayer|dua for the opening of the prayer
in_prayer|dua to say in the tashahhud
visiting_graves|I am going to the graveyard to visit my grandfather
visiting_graves|what do I say when visiting the cemetery
visiting_graves|dua for visiting graves
hosting|my guests are leaving, what do I say
hosting|I want to thank my host for the dinner
hosting|thank you for the meal, dua for the family who invited me
betrayal|my husband cheated on me
betrayal|my best friend betrayed me
betrayal|she backstabbed me and I feel broken
new_beginning|I am starting a new chapter in my life
new_beginning|arriving in a new city tonight
new_beginning|starting my homework
new_beginning|about to start a new project
provision|money
provision|I want money
provision|I want a fast car
provision|I want to be rich
provision|I need cash
job|job
parents|mom
depression|sad
eating|food
drinking_water|water
forgiveness|forgive
`;

export const TUNING: EvalCase[] = parseCases(RAW);
