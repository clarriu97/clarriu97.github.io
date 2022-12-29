/* Change this file to get your personal Portfolio */

// To change portfolio colors globally go to the  _globalColor.scss file

import emoji from "react-easy-emoji";
import splashAnimation from "./assets/lottie/splashAnimation"; // Rename to your file name for custom animation

// Splash Screen

const splashScreen = {
  enabled: true, // set false to disable splash screen
  animation: splashAnimation,
  duration: 2000 // Set animation duration as per your animation
};

// Summary And Greeting Section

const illustration = {
  animated: true // Set to false to use static SVG
};

const greeting = {
  username: "Carlos Larriu",
  title: "Hello world, I'm Carlos",
  subTitle: emoji(
    "\"There are two ways of constructing a software design. One way is to make it so simple that there are obviously no deficiencies and the other is to make it so complicated that there are no obvious deficiencies.\" C.A.R Hoare"
  ),
  resumeLink:
    "https://drive.google.com/file/d/1zsV3ukhzbK5Q8a8s2NOi0nayIqZb1bzl/view?usp=share_link", // Set to empty to hide the button
  displayGreeting: true // Set false to hide this section, defaults to true
};

// Social Media Links

const socialMediaLinks = {
  github: "https://github.com/clarriu97",
  linkedin: "https://www.linkedin.com/in/carloslarriu/",
  gmail: "larriucarlos@gmail.com",
  gitlab: "https://gitlab.com/clarriu97",
  medium: "https://medium.com/@larriucarlos",
  stackoverflow: "https://stackoverflow.com/users/14889035/larrib0y",
  // Instagram, Twitter and Kaggle are also supported in the links!
  // To customize icons and social links, tweak src/components/SocialMedia
  display: true // Set true to display this section, defaults to false
};

// Skills Section

const skillsSection = {
  title: "What I do",
  subTitle: "CRAZY SOFTWARE DEVELOPMENT",
  skills: [
    emoji("⚡ Development and implementation of AI-based API's and microservices"),
    emoji("⚡ CI/CD Always and in any situation"),
    emoji("⚡ Communication, collaboration and adaptability")
  ],

  /* Make Sure to include correct Font Awesome Classname to view your icon
https://fontawesome.com/icons?d=gallery */

  softwareSkills: [
    {
      skillName: "Docker",
      fontAwesomeClassname: "fab fa-docker"
    },
    {
      skillName: "Python",
      fontAwesomeClassname: "fab fa-python"
    },
    {
      skillName: "Telegram Bots",
      fontAwesomeClassname: "fab fa-telegram"
    },
    {
      skillName: "Java",
      fontAwesomeClassname: "fab fa-java"
    },
    {
      skillName: "Linux",
      fontAwesomeClassname: "fab fa-brands fa-linux"
    },
    {
      skillName: "Git",
      fontAwesomeClassname: "fab fa-brands fa-git-alt"
    }
  ],
  display: true // Set false to hide this section, defaults to true
};

// Education Section

const educationInfo = {
  display: true, // Set false to hide this section, defaults to true
  schools: [
    {
      schoolName: "Public University of Navarra",
      logo: require("./assets/images/upnaLogo.png"),
      subHeader: "Degree in Telecommunication Engineering",
      duration: "September 2016 - April 2021",
      descBullets: [
        "Telematic mention"
      ]
    }
  ]
};

// Your top 3 proficient stacks/tech experience

const techStack = {
  viewSkillBars: true, //Set it to true to show Proficiency Section
  experience: [
    {
      Stack: "Microservices architecture", //Insert stack or technology you have experience in
      progressPercentage: "85%" //Insert relative proficiency in percentage
    },
    {
      Stack: "DevOps, CI/CD, QA",
      progressPercentage: "90%"
    },
    {
      Stack: "Object Oriented Programming",
      progressPercentage: "80%"
    }
  ],
  displayCodersrank: false // Set true to display codersrank badges section need to changes your username in src/containers/skillProgress/skillProgress.js:17:62, defaults to false
};

// Work experience section

const workExperiences = {
  display: true, //Set it to true to show workExperiences Section
  experience: [
    {
      role: "Backend Engineer",
      company: "Veridas",
      companylogo: require("./assets/images/veridasLogo.png"),
      date: "July 2021 – Present",
      desc: "Voice Biometrics Software Developer",
      descBullets: [
        "Design, development and maintenance of the whole das-Peak environment, a Veridas SAAS microservice based on Artificial Intelligence applied to the field of voice biometrics. This is done by using technologies such as Python, Flask, Gunicorn and Docker.",
        "Design, development and maintenance of a few Telegram bots used to collect audio datasets and show Veridas voice biometrics technology to our customers.",
        "Devops profile: huge effort in CI/CD, Gitlab pipelines, and software architecture, quality and testing",
        "Production monitoring with Elastic, Kibana and Grafana"
      ]
    },
    {
      role: "Continuous Integration Intern",
      company: "Veridas",
      companylogo: require("./assets/images/veridasLogo.png"),
      date: "Feb 2021 – Jun 2021",
      desc: "Development of Gitlab Pipelines to integrate CI/CD in Front projects. Focused on preparing, testing, linting, documentation and release stages of web projects."
    },
    {
      role: "Tennis and paddle trainer",
      company: "Señorío de Zuasti Golf Club",
      companylogo: require("./assets/images/zuastiLogo.png"),
      date: "Sep 2019 – Dec 2020",
      desc: "Classes for people of all ages."
    }
  ]
};

/* Your Open Source Section to View Your Github Pinned Projects
To know how to get github key look at readme.md */

const openSource = {
  showGithubProfile: "true", // Set true or false to show Contact profile using Github, defaults to true
  display: true // Set false to hide this section, defaults to true
};

// Some big projects you have worked on

const bigProjects = {
  title: "Big Projects",
  subtitle: "Places where I helped to create tech",
  projects: [
    {
      image: require("./assets/images/mowLogo.png"),
      projectName: "Bachelor Degree Thesis",
      projectDesc: "Full Stack development of an Android app for the NGO Medical Open Work",
      footerLink: [
        {
          name: "Visit Website",
          url: "https://medicalopenworld.org/"
        }
        //  you can add extra buttons here.
      ]
    }
  ],
  display: true // Set false to hide this section, defaults to true
};

// Achievement Section
// Include certificates, talks etc

const achievementSection = {
  title: emoji("Achievements And Certifications 🏆 "),
  subtitle:
    "Achievements, Certifications, Award Letters and Some Cool Stuff that I have done !",

  achievementsCards: [
    {
      title: "Google Code-In Finalist",
      subtitle:
        "First Pakistani to be selected as Google Code-in Finalist from 4000 students from 77 different countries.",
      image: require("./assets/images/codeInLogo.webp"),
      imageAlt: "Google Code-In Logo",
      footerLink: [
        {
          name: "Certification",
          url: "https://drive.google.com/file/d/0B7kazrtMwm5dYkVvNjdNWjNybWJrbndFSHpNY2NFV1p4YmU0/view?usp=sharing"
        },
        {
          name: "Award Letter",
          url: "https://drive.google.com/file/d/0B7kazrtMwm5dekxBTW5hQkg2WXUyR3QzQmR0VERiLXlGRVdF/view?usp=sharing"
        },
        {
          name: "Google Code-in Blog",
          url: "https://opensource.googleblog.com/2019/01/google-code-in-2018-winners.html"
        }
      ]
    }
  ],
  display: false // Set false to hide this section, defaults to true
};

// Blogs Section

const blogSection = {
  title: "Blogs",
  subtitle:
    "With Love for Developing cool stuff, I love to write and teach others what I have learnt.",
  displayMediumBlogs: "true", // Set true to display fetched medium blogs instead of hardcoded ones
  blogs: [
    {
      url: "https://blog.usejournal.com/create-a-google-assistant-action-and-win-a-google-t-shirt-and-cloud-credits-4a8d86d76eae",
      title: "Win a Google Assistant Tshirt and $200 in Google Cloud Credits",
      description:
        "Do you want to win $200 and Google Assistant Tshirt by creating a Google Assistant Action in less then 30 min?"
    },
    {
      url: "https://medium.com/@saadpasta/why-react-is-the-best-5a97563f423e",
      title: "Why REACT is The Best?",
      description:
        "React is a JavaScript library for building User Interface. It is maintained by Facebook and a community of individual developers and companies."
    }
  ],
  display: false // Set false to hide this section, defaults to true
};

// Talks Sections

const talkSection = {
  title: "TALKS",
  subtitle: emoji(
    "I LOVE TO SHARE MY LIMITED KNOWLEDGE AND GET A SPEAKER BADGE 😅"
  ),

  talks: [
    {
      title: "Build Actions For Google Assistant",
      subtitle: "Codelab at GDG DevFest Karachi 2019",
      slides_url: "https://bit.ly/saadpasta-slides",
      event_url: "https://www.facebook.com/events/2339906106275053/"
    }
  ],
  display: false // Set false to hide this section, defaults to true
};

// Podcast Section

const podcastSection = {
  title: emoji("Podcast 🎙️"),
  subtitle: "I LOVE TO TALK ABOUT MYSELF AND TECHNOLOGY",

  // Please Provide with Your Podcast embeded Link
  podcast: [
    "https://anchor.fm/codevcast/embed/episodes/DevStory---Saad-Pasta-from-Karachi--Pakistan-e9givv/a-a15itvo"
  ],
  display: false // Set false to hide this section, defaults to true
};

const contactInfo = {
  title: emoji("Contact Me ☎️"),
  subtitle:
    "Discuss a project or just want to say hi? My Inbox is open for all.",
  number: "+34 680587439",
  email_address: "larriucarlos@gmail.com",
};

// Twitter Section

const twitterDetails = {
  userName: "carloslarriu", //Replace "twitter" with your twitter username without @
  display: false // Set true to display this section, defaults to false
};

const isHireable = true; // Set false if you are not looking for a job. Also isHireable will be display as Open for opportunities: Yes/No in the GitHub footer

export {
  illustration,
  greeting,
  socialMediaLinks,
  splashScreen,
  skillsSection,
  educationInfo,
  techStack,
  workExperiences,
  openSource,
  bigProjects,
  achievementSection,
  blogSection,
  talkSection,
  podcastSection,
  contactInfo,
  twitterDetails,
  isHireable
};
