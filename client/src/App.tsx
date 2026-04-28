import Login from "@/tabs/auth/login"
import Signup from "@/tabs/auth/signup"
import Homesection from "./tabs/features/homesection"
import Quickstart from "./tabs/features/quickstart"
import Recentactivity from "./tabs/features/recentactivity"
import Interview from "./tabs/features/interview"
import Analytics from "./tabs/features/analytics"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import reactsvg from "./assets/react.svg"

function App() {
  const router = createBrowserRouter([
    {
      path: "/signup",
      element: <><Signup /></>
    },
    {
      path: "/",
      element: <><Login /></>
    },
    {
      path: "/homesection",
      element: <><Homesection /></>
    },
    {
      path: "/quickstart",
      element: <><Quickstart /></>
    },
    {
      path: "/recentactivity",
      element: <><Recentactivity /></>
    },
    {
      path: "/interview",
      element: <><Interview imageUrl={reactsvg} /></>
    },
    {
      path: "/analytics",
      element: <><Analytics /></>
    }
  ])

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
