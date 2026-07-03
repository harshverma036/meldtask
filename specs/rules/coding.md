## Defined rules for backend and frontend in terms of coding. 

Frontend: -

Code and codebase structure wise -

- You have to use only tailwindcss for styling and shadcn component library for any component usage.
- Make sure every page and component that you use and created should be from Shadcn only. 
- For any api call use transtack query (docs: - https://tanstack.com/query/latest) for any muation and query api calls. Also implement caching and all in api call too.
- Use axios only.
- Make sure you re-use more and more components and the code should not be very long and long you have to break into different component so that it will be optimze as much as you can.
- For date manipulation - use date-fns package only.
- You can add any component you want yourself from shadcn (docs - https://ui.shadcn.com/docs/components)
- For any success and failed, show proper error to user in a toast. use this package - (docs - https://www.npmjs.com/package/react-toastify)

Design Wise -

- Always use dark mode and structure project accordinlgy.
- The design should be neat, clean and very consistent. 
- The componenets and anything you use should be with the application theme. 
- Everything should be responsive always. 


Backend: -
- Always break code into function and all. 
- For every api use zod for validation if any data is getting passed in the api. 
- Always use proper Error handling and try to cover each and ever case. 
- Don't use any type, just define types and interfaces for everything
- Always add comments and proper code documentation for everything you do.

For agent: -
- After every execution just make sure you create a .md file inside rules rolder with same number sequence and dump decisons that you took and everything you did. just document it properly. 