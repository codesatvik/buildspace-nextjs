
import { SignOutButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div>
      buildspace
      <SignOutButton redirectUrl="/sign-in" >
         <button className="rounded bg-red-500 px-4 py-3 text-white">
         SignOut
         </button>
      </SignOutButton>
      
    </div>
  );
}
