Service graph :
=============== 
**End-to-End dependency graphing and monitoring system for a distributed web services environment**

The project started as a random hack on graph visualization, and it ended up as a full-fledged web services monitoring framework with an intuitive graph visualization of the services ecosystem, drill-down graphs of related metrics.

What does it do?
===============

The landing page shows the **dependencies** among all the services and the **metrics** like error rate and avg. response time of each service. The WebStoreService and EmailService are the user facing services, so they do not have any calls associated with them. Otherwise, each service has a an avg.resp. time and error rate associated with them.

![alt tag](https://raw2.github.com/narendran/service-graph/master/snapshots/landing.png)

When one of the services starts showing **high error rate**, you can set a threshold above which the service node turns red giving an immediate indication that the service needs attention.
![alt tag](https://raw2.github.com/narendran/service-graph/master/snapshots/error.png)

When one of the services (DBService in this case) starts experiencing **high latency** for some reason, again, you can set a threshold above which the service node turns blue. You can also find that the services that depend on DBService like AuthService and PreferencesService experiencing higher latency because the downstream DBService is misbehaving.

![alt tag](https://raw2.github.com/narendran/service-graph/master/snapshots/delay.png)

On clicking on a service node, you can see a **time-series** chart of the how the services has been performing for the past few hours. 

![alt tag](https://raw2.github.com/narendran/service-graph/master/snapshots/service.png)

In enterprise architectures, it is a general practice to deploy the same service across multiple data centers as a DR/backup mechanism. When we see that a service is misbehaving from the landing page, the next step is to narrow down to the actual issue. It could be a problem with the business logic, the RPC framework, infrastructure issues etc. In this case getting a **data center level breakup and server level breakup** is of immense help.

![alt tag](https://raw2.github.com/narendran/service-graph/master/snapshots/dc-breakup.png)


Getting started :
=================

Clone the service-graph repository to your local machine. 
    git clone https://github.com/narendran/service-graph.git

Libraries required :
--------------------
* NodeJS - Serves the webpages, exposes the required REST services to serve the runtime RPC metrics.
* MongoDB - NoSQL data store which stores the dependency graph, RPC service metrics and the RPC client metrics.
* Redis - Key-Value store for serving the real-time metrics to the landing page.

Steps :
-------
1. Start the mongoDB server and redis server. Right now, the domains where these servers lie are hardcoded. So to get started run them on localhost.
2. Our monitoring system depends on tuples of the following form 
	*{'instance': getHierAddr(config.addr),'service': config.service\_name,'calls': 0,'total\_resp\_ms': 0,'errors': 0,'avg\_resp\_ms': 0}*
3. The tuple mentioned above should be generated by each RPC service every second and pushed into the Redis MQ (Channel : "servicestats"). Please refer the sample\_server.js file to get the list of channels we currently use.
4. As and when a new tuple is pushed into the message queue, we calculate the running average of average response time and error rate.
5. Now the infrastructure part is done, but to quickly get started, we have created a mock infrastructure under mock\_infra. To get the mock services up and running start all the services by executing "node sample\_server.js abc.js". Start all the services present under the mock\_infra directory (auth1.json, auth2.json ..) because as in any real-world scenario they are interconnected. Next, start the mock load generator by executing "python loadgen.py". 
6. Start the main controller by executing "node server.js" under the server directory. Once started, you should be able to see your landing page in localhost:8000. If everything is good, you should see a landing page similar to the following :

![alt tag](https://raw2.github.com/narendran/service-graph/master/snapshots/landing.png)

Improvements and bugs welcome!
==============================
Anup and I, we put this up as part of a 24 hour hackathon. Thanks to Intuit for hosting it. Considering the limited time frame, we did have a lot of improvements in mind, but were unable to implement them. However, we are happy to make fixes and improvements to make sure the users get the best experience.
 



