## Initial setup of frontend and backend in this turborepo with the database setup along with auth

You have an empty turborepo in which we want to setup a new project. this is a task, team, goal and more management and tracking.

## Step 1 
for now we want to setup the services needed to build the project and setup it. -
    - Frontend - use vite + react and it will land on direct login page. For design use tailwind v4 css and shadcn. 
    - Backend - a typescript + express backend which export different apis for the user.
    - Databse - Portgres + Prisma will be the database layer. It should be created inside packages called db and will be re-used by in the whole application.


## Step 2

Frontend - the login auth should be crated and will be the first thing user see when land on our website. it upports google login. once login the sidebar shoud be there and the dashbaord top bar should be there with view profile and logout option and at the center of the topbar there should be a input search text which says "Search everything...". also the theme will be on complete deep dark mode. it should be responsive too. 

Backend - add support of authentation using google and email.

whenever environment variables will be there, just put them into the example env with proper comments and all. i will add value to it. also add what could be the value for the each variable (as example) comment.

and once these all done, add commands in top level package.json and tell me what to execute. 