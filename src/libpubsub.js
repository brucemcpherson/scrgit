// handles pubsub stuff

const Pubber = require("./pubber");

module.exports = ((ns) => {
  let clientPack = null;

  // this is how long before a republish happens
  ns.getIdleTime = () => ns.connection.options.idleTime;

  // get a client
  ns.init = ({ connection, forcePush }) => {
    ns.connection = connection;
    const { options, subjects: details } = connection;
    const { serviceAccount } = options;

    const pubber = new Pubber({
      details,
      gcpCreds: serviceAccount,
      forcePush: Boolean(forcePush === null ? details.pusher : forcePush),
    });
    // return a client package
    clientPack = {
      pubber,
      details,
    };
    return ns;
  };

  // this handles a push message
  ns.handlePush = (pack) => clientPack.pubber.handlePush(pack);

  // see if this is a pusher
  ns.isPusher = () => clientPack.pubber.pusher;

  // get topic and subscription details for this mode
  ns.getDetails = () => clientPack && clientPack.details;

  // subscribe
  ns.subscribe = (pack) => clientPack.pubber.subscribe(pack);

  // message handler
  ns.onMessage = (pack) => clientPack.pubber.onMessage(pack);

  // stop handling the message
  ns.offMessage = (pack) => clientPack.pubber.offMessage(pack);

  // publish an object data
  ns.publish = (pack) => clientPack.pubber.publish(pack);

  // set up a push pubsub
  ns.makePusher = (pack) => clientPack.pubber.makePusher(pack);

  return ns;
})({});
