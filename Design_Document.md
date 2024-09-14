# Social Media API

Creating an API that Implements all the necessary bits and pieces of fundamental backend development

## Technologies used

- `language`: Node with express.js
- `storage`: [cloudinary](https://cloudinary.com/)
- `database`: [postgresql](https://www.postgresql.org/)
- `orm`: [drizzle](https://orm.drizzle.team/)

## User Management

- JWT Authentication, Authorization, Refresh Tokens with support for multiple devices
- Email verify, Forget password, Change Email
- Basic user data (for images cloudinary is used)
- User roles (Admin, User)
- Emails for events like email verification, password reset

### User Auth

> What should I use? Should I roll my own Auth? Use a 3rd party service? Which service to use?

For this I will be rolliong my own Auth with JWT Ideally with refresh tokens

> - I will be using a refresh token to generate a new access token when it expires
> - Refresh token will be stored in the database with a expiry date
> - Access token will have an expiry of 5 minutes
> - Refresh token will have an expiry of 30 days
> - When an access token expires the user will have to use the refresh token to get a new access token
> - While issuing a new access token I will also issue a new refresh token
> - For every login (users logs on multiple devices) a new refresh token will be issued
> - Refresh token will be deleted when the user logs out
> - Refresh token will be deleted when the user changes their email/password
> - All Refresh tokens will be deleted when the user choses to logs out from all devices
> - Expired refresh tokens will be deleted periodically
> - If users access token is stolen they can log out from all devices to invalidate
>   all refresh tokens Or contact the admin to invalidate all refresh tokens

Image data will be stored in a separate table with a `type` field equal to `profile` and the
foreign key to the user table

User will be able to change their email and password and will be able to verify their email

## Posts

- CRUD, Like, Comment
- Not just text but images too
- Tagging users

Design decisions:

- For likes Ideally on the frontend use optimistic updates
- How to store likes? (In the post table or a separate table or both)

  > For simplicity I will store the likes in likes table

  Some other considerations

  > For a huge scale, I would store the likes in separate table and in the post table.
  > I would also use a redis cache to store the likes count for a post
  >
  > - For updating the likes count I would use something like a message queue or batch\
  >   multiple request and update at once?

  > - Or periodically update the likes count in the post table?

- Comments will be stored in a separate table and will be displayed 5 at a time
  with most recent comments first

  > - Author of the post can delete the comments
  > - If a user has commented on the post and views the post their comment will be
  >   displayed at the top to them
  > - If a post is deleted all the comments will be deleted
  > - If an user is deleted all their comments will be deleted
  > - Users can see all the comments they have made

- Tagging users will query the username of users and store it in tags table

  > - Can tag upto 5 users in a post
  > - User will get a notification when they are tagged in a post
  > - User can see all the posts they are tagged in
  > - User can see all the posts they have tagged in

- Sharing can be done in frontend by copying the link and sharing it

## Notifications

To store the notifications we can use a table with columns like:

- `user_id`
- `message`
- `type` (post, comment, tag)
- `read` (boolean)

this will be inserted when a user likes a post or comments on a post or tags a user.

How to insert them?

> I will be using a async task queue to insert the notifications as it is not a critical operation
> I am thinking of using websockets to send the notifications to the user in real time

## Mail Service

I will be using [resend](https://resend.com/) for sending emails

## Database Schema

This is the initial schema that I will be using at start. refer the actual schema for the final schema

### User

- `id`: UUID
- `email`: String
- `password`: String
- `role`: Enum('admin', 'user')
- `email_verified`: Boolean
- `username`: String
- `profile_image`: UUID
- `created_at`: Timestamp
- `updated_at`: Timestamp

## Authentication

- `id`: UUID
- `user_id`: UUID
- `refresh_token`: String
- `device`: String // User agent
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `expires_at`: Timestamp

### Image

- `id`: UUID
- `user_id`: UUID
- `type`: Enum('profile', 'post')
- `url`: String
- `public_id`: String
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Post

- `id`: UUID
- `user_id`: UUID
- `content`: String
- `image_id`: UUID
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Like

- `id`: UUID
- `user_id`: UUID
- `post_id`: UUID
- `created_at`: Timestamp

### Comment

- `id`: UUID
- `user_id`: UUID
- `post_id`: UUID
- `content`: String
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Notification

- `id`: UUID
- `user_id`: UUID
- `message`: String
- `type`: Enum('post', 'comment', 'tag')
- `read`: Boolean
- `created_at`: Timestamp
- `updated_at`: Timestamp
