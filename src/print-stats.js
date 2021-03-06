// @flow
import AWS from "aws-sdk"
import CloudWatch from "./cloudwatch.js"
import {nsToDimName} from "./metrics.js"
import {toSeconds} from "./time.js"
import {ls_ec2} from "./ls-ec2.js"
import path from "path"

type Params = {
  _: Array<string>;
  region: string;
  duration: string;
  statistics: string;
  "end-time": string;
}

function print_stats(argv: Params): Promise {
  //let [ instID, metricName = 'CPUUtilization', ns = 'AWS/EC2'] = argv._;  // flow doesn't support
  let instIDs    = argv._[0]
  let metricName = argv._[1] || "CPUUtilization"
  let ns         = argv._[2] || "AWS/EC2"
  let dimName    = nsToDimName(ns)
  let region     = argv.region || process.env.AWS_DEFAULT_REGION || "ap-northeast-1"
  let period     = toSeconds(argv.period || "30minutes")
  let stats      = argv.statistics

  if (!instIDs) {
    //throw new Error("instanceID is missing")
    return Promise.reject(new Error("InstanceId is missing"))
  }

  AWS.config.update({region});

  let watch = (instanceID) =>
    new CloudWatch()
      .endTime(argv["end-time"])
      .duration(argv.duration || "1day")
      .period(period)
      .statistics(stats)
      .metricStatistics(ns, instanceID, metricName)
      .then(([sep, data]) => ({
        Namespace: ns,
        [dimName]: instanceID,
        ...sep,
        ...data,
      }))

  let a = instIDs.match("^tag:(.*)")
  if (a && ns === "AWS/RDS")
    return Promise.reject(new Error("filters is not supported AWS/RDS"))

  let p = (a ? ls_ec2(a[1]) : Promise.resolve(instIDs))
  return p.then(s => s.split(","))
          .then(s => Promise.all(s.map(e => watch(e.trim()))))
}

module.exports = {
  print_stats,
}

if (require.main === module) {
  print_stats(require("minimist")(process.argv.slice(2)))
    .then(r => process.stdout.write(JSON.stringify(r)))
    .catch(err => {
      //process.stderr.write(JSON.stringify(err, null, 2));
      console.error(err);
      process.exit(1);
    })
}
