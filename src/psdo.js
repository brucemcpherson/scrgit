const libpubsub = require("./libpubsub");

// set up pubsub
const psCommon = {
  idleTime: 60000,
  pusher: false,
};

// generate the subjects automatically
const genSubject = ({ key, mode, prefix = "" }) => {
  const ob = {};
  const suffix = prefix ? "-" + prefix : "";
  const name = `scrgit-${key}-${mode}${suffix}`;
  ob[prefix ? prefix + "TopicName" : "topicName"] = name;
  ob[prefix ? prefix + "SubscriptionName" : "subscriptionName"] = name;
  return ob;
};

const genSubjects = ({ key, mode }) => {
  return {
    ...genSubject({ key, mode }),
    ...genSubject({ key, mode, prefix: "test" }),
  };
};

const cobs = {
  psp: {
    options: {
      ...psCommon,
      serviceAccount: require("../secrets/scrviz-pubsub.json"),
    },
  },
};

// this is the only exposed thing
const getConnection = ({ mode }) => {
  // connection object specific to this type
  const targetMode = cobs[mode];

  return {
    options: targetMode.options,
    subjects: {
      scrgit: genSubjects({ mode, key: "vizzycache" }),
    },
  };
};
const init = () => {
  return libpubsub.init({ connection: getConnection({mode: 'psp'}) });
};
module.exports = {
  init,
};
