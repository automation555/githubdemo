package javacodechecker;

import java.io.Externalizable;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;

//EMB-ISSUE: CodeIssueNames.EXTERNALIZABLE_MUST_HAVE_NO_ARGUMENTS_CONSTRUCTOR
public class ExternalizableMustHaveNoArgumentsConstructor implements Externalizable {
	private String name;
	private int age;


	public void newMethod() {

	}
    public ExternalizableMustHaveNoArgumentsConstructor(String name, int age) {
		this.name = name;
		this.age = age;
	}


}