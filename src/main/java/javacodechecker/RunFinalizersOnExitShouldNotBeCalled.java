
package javacodechecker;
public class RunFinalizersOnExitShouldNotBeCalled 
{
	public static void runFinalizersOnExit(boolean value) {
	// EMB-ISSUE: CodeIssueNames.RUN_FINALIZERS_ON_EXIT_SHOULD_NOT_BE_CALLED
		System.runFinalizersOnExit(value);

}
}