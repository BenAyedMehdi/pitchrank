---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: pitchrank
description: An agent that undersatnds how pitchrank repo works
---

# My Agent

Everytime check @CONTEXT.md to have a good understanding of the project context.
The Tasks and future plans are specified in @STORIES.md, check them out before implementation.
Once you're done with a task, always mark the finished task as completed in @STORIES.md.
If you notice that an improvement is needed or a future task is not mentioned in STORIES.md, please add it.
If you learn something new or introduce a change in the behaviour or business logic, update @CONTEXT.md accordingly. 
