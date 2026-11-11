// Holiday Game Show: content extracted from the two supplied PDFs.
// Standard questions award 10 points; Feud uses survey points; timer: 60 seconds.
const QUESTION_SET_ID = 'holiday-game-show-49-v1';
const HOLIDAY_ROUNDS = [
  { title: 'Holiday Brain Freeze', background: 'slides-p01-1.webp', description: 'Nine questions to warm up your holiday knowledge.' },
  { title: 'Decode the Decor', background: 'slides-p04-1.webp', description: 'Solve the holiday picture puzzle.' },
  { title: 'Guess That Tune', background: 'slides-p07-1.webp', description: 'Listen to the clip your host plays, then name the song.' },
  { title: 'Picture Perfect', background: 'slides-p10-1.webp', description: 'Identify movies, winter sights, food, and characters.' },
  { title: 'The Festive Feud', background: 'slides-p13-1.webp', description: 'Give one popular answer. The survey points are up for grabs!' },
  { title: 'The Final Countdown', background: 'slides-p16-1.webp', description: 'Odd ones out, holiday phrases, close-ups, true or false, and spot the difference.' }
];
const QUESTIONS = (() => {
  const image = (file, alt, presentation) => ({ src: 'assets/holiday/' + file + '.webp', alt, presentation });
  const choice = (round, question, options, answer, extra = {}) => ({ round, type: 'choice', question, options, answer, points: 10, ...extra });
  const text = (round, question, answer, extra = {}) => ({ round, type: 'text', question, answer, points: 10, ...extra });
  const feud = (question, rows) => text(5, question, rows.flatMap(r => r[2]), { rankedAnswers: rows.map(([label, points, aliases]) => ({ label, points, aliases })) });
  const tune = (number, title, artist, aliases = [], extra = {}) => text(3, `Name that holiday tune — clip ${number}`, [title, ...aliases], {
    instruction: 'Listen to the music your host plays and type the song title.',
    hostNote: `Play a clip of “${title}” (${artist}) from your music player and share computer audio on Zoom. The PDFs contain no audio.`,
    explanation: `${title} — ${artist}`, ...extra
  });
  return [
    choice(1, 'Which country is credited with popularizing the tradition of decorating Christmas trees?', ['France', 'Germany', 'Italy', 'England'], 1, { revealImages: [image('slides-p03-2', 'A Christmas market in Germany')] }),
    choice(1, 'Which country receives some of the heaviest snowfall in the world?', ['Canada', 'Switzerland', 'Japan', 'Norway'], 2, { explanation: 'Japan is home to some of the snowiest inhabited places on Earth, particularly in its northern and mountainous regions.' }),
    choice(1, "In Home Alone, where is Kevin's family travelling when they accidentally leave him behind?", ['London', 'Paris', 'New York', 'Rome'], 1),
    choice(1, 'What is the name of the period leading up to Christmas, traditionally marked by a calendar?', ['Lent', 'Advent', 'Epiphany', 'Solstice'], 1),
    choice(1, 'What is the coldest temperature ever officially recorded on Earth?', ['−67.0°C', '−89.2°C', '−100.5°C', '−75.4°C'], 1, { explanation: 'Recorded at Vostok research station in Antarctica in 1983.' }),
    choice(1, 'In How the Grinch Stole Christmas, what is the name of the town where the Whos live?', ['Merryville', 'Christmasville', 'Snowtown', 'Whoville'], 3),
    choice(1, 'What is the name of the phenomenon where the Northern Lights appear in the sky?', ['Solar Eclipse', 'Aurora Borealis', 'Milky Way', 'Solar Flare'], 1),
    choice(1, 'In The Twelve Days of Christmas, what gift is given on the fifth day?', ['Five golden rings', 'Five silver bells', 'Five calling birds', 'Five gold coins'], 0),
    choice(1, 'Which Christmas song was the first song ever played in space?', ['Jingle Bells', 'Silent Night', 'White Christmas', 'Rudolph the Red-Nosed Reindeer'], 0),
    text(2, 'Decode the holiday phrase in this picture.', ['Nice list', "Santa's nice list"], { images: [image('slides-p05-2', 'Holiday rebus: n plus ice cubes plus a list', 'rebus')], revealImages: [image('slides-p06-2', 'Rebus solution: n-ice list', 'rebus')], explanation: 'N + ice + list = nice list.' }),
    tune(1, 'Winter Wonderland', 'Michael Bublé'),
    tune(2, 'Jingle Bell Rock', 'Bobby Helms'),
    tune(3, 'Let It Snow! Let It Snow! Let It Snow!', 'Dean Martin', ['Let It Snow', 'Let It Snow Let It Snow']),
    tune(4, 'Snowman', 'Sia'),
    tune(5, "Rockin' Around the Christmas Tree", 'Brenda Lee', ['Rocking Around the Christmas Tree']),
    tune(6, 'Last Christmas', 'Wham!'),
    tune(7, 'Jingle Bells', 'the additional example in the slide deck', [], { revealImages: [image('slides-p09-2', 'Jingle Bells answer card')] }),
    text(4, 'Guess the holiday movie.', ['Elf'], { images: [image('slides-p11-2', 'A holiday movie scene with a character riding an escalator')], revealImages: [image('slides-p12-2', 'Elf movie poster')] }),
    text(4, 'Identify the winter sport.', ['Curling'], { images: [image('questions-p05-1', 'Athletes on ice with stones and brushes')] }),
    text(4, 'Identify the winter animal.', ['Snowy owl', 'Snow owl'], { images: [image('questions-p05-2', 'A white bird resting in the snow')] }),
    text(4, 'Guess the holiday bread.', ['Panettone', 'Panetone'], { images: [image('questions-p05-3', 'A tall holiday bread with dried fruit')] }),
    text(4, 'Guess the winter destination: which country?', ['Switzerland', 'Swiss Alps'], { images: [image('questions-p06-1', 'Wooden chalets in a snowy mountain landscape')] }),
    text(4, 'Guess the character.', ['Sven', 'Sven from Frozen'], { images: [image('questions-p06-2', 'An animated reindeer character')] }),
    feud('Name something people do as soon as they finish work for the holidays.', [
      ['Sleep / relax',30,['sleep','relax','sleep relax','rest','sleep in','take a nap']],
      ['Travel',25,['travel','go on vacation','vacation','go on holiday']],
      ['Spend time with family',20,['spend time with family','family','visit family','see family']],
      ['Start Christmas shopping (finally!)',15,['start Christmas shopping','Christmas shopping','shopping','buy gifts']],
      ['Watch holiday movies',10,['watch holiday movies','watch Christmas movies','holiday movies','Christmas movies']]
    ]),
    feud('Name something people always forget to buy before Christmas.', [
      ['A gift for someone',30,['a gift for someone','gift','gifts','present','presents']],
      ['Wrapping paper',25,['wrapping paper','gift wrap']], ['Tape',20,['tape','scotch tape','sticky tape']],
      ['The one ingredient missing from Christmas dinner',15,['ingredient','missing ingredient','dinner ingredient','the one ingredient missing from Christmas dinner']],
      ['Christmas crackers for the dinner table',10,['Christmas crackers','crackers','Christmas crackers for the dinner table']]
    ]),
    feud('Name a food people look forward to during the holidays.', [
      ['Turkey',30,['turkey','roast turkey']], ['Cookies',25,['cookies','Christmas cookies','cookie']],
      ['Mashed potatoes',20,['mashed potatoes','mash']], ['Stuffing',15,['stuffing','dressing']], ['Pie',10,['pie','pies','pumpkin pie','apple pie']]
    ]),
    feud('Name something that can go wrong at a holiday gathering.', [
      ['Burning the Christmas dinner',30,['burning the Christmas dinner','burn dinner','burning dinner','burnt dinner','burn the turkey','burning the food']],
      ['Someone showing up two hours late',25,['someone showing up two hours late','late guests','arrive late','being late','late','someone is late']],
      ["Forgetting someone's gift",20,["forgetting someone's gift",'forget a gift','forgot a gift','forgetting gifts']],
      ['Spilling a drink on the couch',15,['spilling a drink on the couch','spill a drink','spilling a drink','spilled drink']],
      ['A snowstorm',10,['snowstorm','snow storm','blizzard']]
    ]),
    feud('Name something people do when they hear their favourite holiday song.', [
      ["Sing like they're on tour",30,['sing','sing along','singing',"sing like they're on tour"]],
      ['Get up and dance',25,['dance','dancing','get up and dance']],
      ['Turn the volume all the way up',20,['turn the volume all the way up','turn up the volume','turn it up','volume up']],
      ['Reminisce about Christmases past',15,['reminisce','reminisce about Christmases past','remember past Christmases','nostalgia']],
      ["Skip it because they've heard it 100 times",10,['skip','skip it','skip the song','change the song']]
    ]),
    feud("Name a funny reason someone might end up on Santa's naughty list.", [
      ['Eating all the Christmas cookies',30,['eating all the Christmas cookies','eat all the cookies','eating all the cookies','eating cookies']],
      ['Peeking at presents early',25,['peeking at presents early','peeking at presents','opening presents early','peek at gifts']],
      ["Stealing someone's food",20,["stealing someone's food",'stealing food','steal food']],
      ['Playing Christmas music in November',15,['playing Christmas music in November','Christmas music in November']],
      ['Pretending to be asleep to avoid helping',10,['pretending to be asleep to avoid helping','pretending to sleep','pretending to be asleep','not helping']]
    ]),
    feud("Name something people secretly do when they receive a gift they don't like.", [
      ['Pretend to absolutely love it',30,['pretend to absolutely love it','pretend to love it','pretend','fake a smile','act happy']],
      ['Regift it next Christmas',25,['regift','regift it','regift it next Christmas']],
      ['Hide it in a closet',20,['hide it in a closet','hide it','put it in a closet']],
      ["Look up how much it's worth",15,["look up how much it's worth",'check the price','look up the price','look up its value']],
      ['Give it to someone else',10,['give it to someone else','give it away','donate it','donate']]
    ]),
    choice(6, "Which animal is the odd one out — the one that isn't a member of the deer family?", ['A','B','C','D'], 1, {
      images: [image('questions-p11-1','Animal A'),image('questions-p11-2','Animal B'),image('questions-p11-3','Animal C'),image('questions-p11-4','Animal D')],
      answerLabel: 'B — Donkey', explanation: 'The donkey is the odd one out; the other three animals are members of the deer family.', revealImages: [image('slides-p18-2','The donkey is the odd one out')]
    }),
    choice(6, 'Which plant is the odd one out from these traditional Christmas plants?', ['Mistletoe','Holly','Poinsettia','Rose'], 3),
    choice(6, 'Which occasion is the odd one out from the year-end holiday season?', ['Boxing Day','Christmas Eve',"New Year's Eve","Valentine's Day"], 3),
    choice(6, 'Which food is the odd one out from a traditional savoury holiday dinner?', ['Turkey','Stuffing','Mashed Potatoes','Ice Cream'], 3),
    choice(6, 'Which baked treat is the odd one out from these Christmas specialities?', ['Stollen','Panettone','Bûche de Noël','Croissant'], 3),
    text(6, 'Finish the holiday phrase: “The best way to spread Christmas cheer is singing loud for all to ____.”', ['Hear']),
    text(6, 'Finish the holiday phrase: “Every time a bell rings, an angel gets his ____.”', ['Wings']),
    text(6, "Finish the holiday phrase: “Seeing isn't believing. Believing is ____.”", ['Seeing']),
    text(6, 'Guess the zoomed-in image.', ['Christmas tree branch','tree branch','pine branch','pine needles','Christmas tree','fir branch'], { images: [image('questions-p12-1','Close-up challenge 1')] }),
    text(6, 'Guess the zoomed-in image.', ['Gingerbread cookie','gingerbread','gingerbread man'], { images: [image('questions-p12-2','Close-up challenge 2')] }),
    text(6, 'Guess the zoomed-in image.', ['Christmas ornament','ornament','bauble','Christmas bauble'], { images: [image('questions-p13-1','Close-up challenge 3')] }),
    text(6, 'Guess the zoomed-in image.', ['Snowflake','snowflake decoration'], { images: [image('questions-p13-2','Close-up challenge 4')] }),
    text(6, 'Guess the zoomed-in image.', ['Candy cane','candy canes'], { images: [image('questions-p13-3','Close-up challenge 5')] }),
    choice(6, 'True or false: Rudolph was originally created for a department store promotion.', ['True','False'], 0),
    choice(6, 'True or false: The first artificial Christmas trees were made using goose feathers.', ['True','False'], 0),
    choice(6, 'True or false: In Japan, eating KFC is a popular Christmas tradition.', ['True','False'], 0),
    choice(6, 'True or false: Santa Claus has nine reindeer, including Rudolph.', ['True','False'], 0),
    choice(6, 'True or false: Christmas trees can grow naturally in Antarctica.', ['True','False'], 1),
    text(6, 'Spot the difference! List the differences between the two pictures.', [], {
      images: [image('questions-p14-1','Two Santa pictures to compare','differences')],
      instruction: 'You have one minute. Describe each difference you can find; your host will review your list.',
      manualReview: true, explanation: 'Your host awards one point per valid difference, up to 10.',
      hostNote: 'Review both pictures and award one point per visible difference (maximum 10). The PDF requests 10 differences but supplies no answer key.'
    })
  ];
})();
