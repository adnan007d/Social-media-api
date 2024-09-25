# A social media api

Implements all the necessary bits and pieces of fundamental backend development

**Before looking at the project I would suggest look at the [design document](./Design_Document.md)
I made That will give you a good idea of what I am trying to achieve with this project.
It also has a lot of information about the design decisions I made.**

-   [x] Users
-   [x] Images
-   [x] Posts
-   [x] Likes
-   [x] Comments
-   [ ] Notifications

Before running the project make sure to create a `.env` file in the root directory with the required environment variables. refer to the `.env.example` file for the required variables.

Note: There are separate DB_NAME for testing and development. Make sure to create the development before running the project, testing database is created automatically by deleting the old test database and creating a fresh one

Requirements:

-   Postgres
-   Redis

If you are using docker you can use the following command to start the required services

```shell
docker pull postgres
docker pull redis
```

```shell
docker run --name pgsql -e POSTGRES_PASSWORD=<YOURPASSWORD> -p 5432:5432 postgres
docker run --name redis -p 6379:6379 redis
```

#### testing

```shell
pnpm test
```

#### Seeding

```
pnpm db:seed
```

Seeding will create a user and a post for testing purposes the password for the user is defined in [src/seed.ts](src/seed.ts)

> Note: Seeding will delete all the data in the database and create new data

Just for the fun I will also be creating a frontend for this project
Will recreate this in Golang too

#### API Endpoints:

Authentication:

-   Signup: `POST /auth/signup`
-   Signin: `POST /auth/signin`

Users:

-   Get Me: `GET /users/me`
-   Update Me: `PATCH /users/me`

Posts:

-   Get All Posts: `GET /posts`
-   Create Post: `POST /posts`
-   Get Post: `GET /posts/:id`
-   Update Post: `PATCH /posts/:id`
-   Delete Post: `DELETE /posts/:id`

Likes:

-   Like Post: `POST /likes/:postId`
-   Unlike Post: `DELETE /likes/:postId`

Comments:

-   Get Comments: `GET /comments/:postId`
-   Create Comment: `POST /comments/:postId`
-   delete Comment: `DELETE /comments/:commentId`
