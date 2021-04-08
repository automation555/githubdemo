package javacodechecker;

public class RunShouldNotBeCalledDirectly {

	public void method() {
		Thread myThread = new Thread();
		// EMB-ISSUE: CodeIssueNames.RUN_SHOULD_NOT_BE_CALLED_DIRECTLY
		myThread.run();
	}

}
